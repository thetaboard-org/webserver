const Boom = require('@hapi/boom')
const got = require('got');
const tfuel_stake_host = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' ? "http://localhost:8002" : "http://147.135.65.155:8002";

const MAX_PUBLIC = 10;
const MAX_AFFILIATE = 5;
const MINIMUM_TFUEL_AVAILABLE = 1500000;
const MINIMUM_TFUEL_AVAILABLE_AFFILIATE = 500000;
const publicEdgeNode = function (server, options, next) {
    server.route([
        {
            method: 'GET',
            path: '/',
            options: {
                handler: async (req, h) => {
                    try {
                        let allPublicEdgeNodes = [];
                        let publicEdgeNodes = [];
                        let minimumAvailable = 0;
                        let affiliate = null;
                        if (req.query && req.query.affiliate) {
                            affiliate = await req.getModel('Affiliate').findOne({where: {'name': req.query.affiliate}});
                            if (affiliate) {
                                allPublicEdgeNodes = await req.getModel('PublicEdgeNode').findAll({
                                    where: {
                                        affiliateId: affiliate.id
                                    },
                                    order: [['stakeAmount', 'ASC']]
                                });
                                publicEdgeNodes = allPublicEdgeNodes.slice(0, MAX_AFFILIATE);
                                minimumAvailable = MINIMUM_TFUEL_AVAILABLE_AFFILIATE;
                            } else {
                                throw 'No affiliate found';
                            }
                        } else {
                            allPublicEdgeNodes = await req.getModel('PublicEdgeNode').findAll({
                                where: {
                                    affiliateId: null
                                },
                                order: [['stakeAmount', 'ASC']]
                            });
                            publicEdgeNodes = allPublicEdgeNodes.slice(0, MAX_PUBLIC);
                            minimumAvailable = MINIMUM_TFUEL_AVAILABLE;

                        }

                        const staked = publicEdgeNodes.reduce((a, b) => a + b.stakeAmount, 0);
                        const maxStaked = publicEdgeNodes.length * 500000;
                        const availableToStake = maxStaked - staked;
                        if (availableToStake < minimumAvailable) {
                            try {
                                const EN = await setupPublicEdgeNode(req, affiliate);
                                setupPublicENSplitReward(EN, affiliate);
                                publicEdgeNodes.unshift(EN);
                                publicEdgeNodes.pop();

                            } catch (e) {
                                console.warn("could not setup EN", e);
                            }
                        }
                        return {"data": publicEdgeNodes};
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        },
    ]);
};

setupPublicEdgeNode = async function (req, affiliate) {
    const maxNodeId = await req.getModel('PublicEdgeNode').max('nodeId') || 2499;
    const edgeNodeId = Number(maxNodeId) + 1;
    let edgeNode;
    let summary;
    try {
        edgeNode = await got(tfuel_stake_host + '/edgeNode/start/' + edgeNodeId);
        summary = await JSON.parse(edgeNode.body).Summary
        if (!summary) {
            throw "No summary";
        }
    } catch (e) {
        edgeNode = await got(tfuel_stake_host + '/edgeNode/summary/' + edgeNodeId);
        summary = await JSON.parse(edgeNode.body).Summary;
        if (!summary) {
            throw "No summary";
        }
    }

    const publicEdgeNode = await req.getModel('PublicEdgeNode').build();
    publicEdgeNode.nodeId = edgeNodeId;
    publicEdgeNode.summary = summary;
    if (affiliate) {
        publicEdgeNode.affiliateId = affiliate.id;
    }
    await publicEdgeNode.save();
    return publicEdgeNode
}

setupPublicENSplitReward = async function (EN, affiliate) {
    const en_addr = EN.summary.slice(0, 42);
    await got(`http://142.44.213.241:8002/edgeNode/write_key?EN_SERVER=${tfuel_stake_host}/edgeNode&EN_ID=${EN.nodeId}`)
    if (!publicEdgeNode.affiliateId) {
        await got(`http://142.44.213.241:8002/edgeNode/do_split?EN_ADDR=${en_addr}&EN_ID=${EN.nodeId}&REWARD_ADDR=0xa078C2852eb6e455f97EeC21e39F8ef24173Df60&SPLIT_REWARD=300`);
    } else {
        await got(`http://142.44.213.241:8002/edgeNode/do_split?EN_ADDR=${en_addr}&EN_ID=${EN.nodeId}&REWARD_ADDR=0xa078C2852eb6e455f97EeC21e39F8ef24173Df60&SPLIT_REWARD=200`);
        await got(`http://142.44.213.241:8002/edgeNode/do_split?EN_ADDR=${en_addr}&EN_ID=${EN.nodeId}&REWARD_ADDR=${affiliate.address}&SPLIT_REWARD=100`);
    }
    EN.splitRewards = true;
    return EN.save();
}


module.exports = {
    register: publicEdgeNode,
    name: 'publicEdgeNode',
    version: '1.0.0'
};