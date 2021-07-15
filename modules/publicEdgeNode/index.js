const Boom = require('@hapi/boom')
const got = require('got');
const tfuel_stake_host = process.env.NODE_ENV === 'production' ? "http://147.135.65.51:8002" : "http://localhost:8002";
const MAX_PUBLIC = 10;
const MINIMUM_TFUEL_AVAILABLE = 1500000;
const publicEdgeNode = function (server, options, next) {
    server.route([
        {
            method: 'GET',
            path: '/',
            options: {
                handler: async (req, h) => {
                    try {
                        let allPublicEdgeNodes = await req.getModel('PublicEdgeNode').findAll({
                            order: [['stakeAmount', 'ASC']]
                        });
                        let publicEdgeNodes = allPublicEdgeNodes.slice(0, MAX_PUBLIC);
                        const staked = publicEdgeNodes.reduce((a, b) => a + b.stakeAmount, 0);
                        const maxStaked = publicEdgeNodes.length * 500000;
                        const availableToStake = maxStaked - staked;
                        const minimumAvailable = MINIMUM_TFUEL_AVAILABLE;
                        if (availableToStake < minimumAvailable) {
                            try {
                                publicEdgeNodes.unshift(await setupPublicEdgeNode(req));
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

setupPublicEdgeNode = async function (req) {
    const maxNodeId = await req.getModel('PublicEdgeNode').max('nodeId') || 2499;
    const edgeNodeId = Number(maxNodeId) + 1;
    let edgeNode;
    let summary;
    try {
        edgeNode = await got(tfuel_stake_host + '/edgeNode/start/' + edgeNodeId);
        summary = await JSON.parse(edgeNode.body).Summary
        if (!summary) {
            throw "No summary"
        }
    } catch (e) {
        edgeNode = await got(tfuel_stake_host + '/edgeNode/summary/' + edgeNodeId);
        summary = await JSON.parse(edgeNode.body).Summary;
        if (!summary) {
            throw "No summary"
        }
    }

    const publicEdgeNode = await req.getModel('PublicEdgeNode').build();
    publicEdgeNode.nodeId = edgeNodeId;
    publicEdgeNode.summary = summary;
    await publicEdgeNode.save();
    return publicEdgeNode
}

module.exports = {
    register: publicEdgeNode,
    name: 'publicEdgeNode',
    version: '1.0.0'
};