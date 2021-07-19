const Boom = require('@hapi/boom')
const got = require('got');
const tfuel_stake_host = process.env.NODE_ENV === 'production' ? "http://147.135.65.49:8002" : "http://localhost:8002";
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
                                publicEdgeNodes.unshift(await setupPublicEdgeNode(req, affiliate));
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

module.exports = {
    register: publicEdgeNode,
    name: 'publicEdgeNode',
    version: '1.0.0'
};