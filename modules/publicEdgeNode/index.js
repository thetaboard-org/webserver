const Boom = require('@hapi/boom')
const got = require('got');
const tfuel_stake_host = process.env.NODE_ENV === 'production' ? "http://147.135.65.155:8002" : "http://localhost:8002";
const MAX_PUBLIC = 1;

const publicEdgeNode = function (server, options, next) {
    server.route([
        {
            method: 'GET',
            path: '/',
            options: {
                handler: async (req, h) => {
                    try {
                        let publicEdgeNodes = await req.getModel('PublicEdgeNode').findAll();
                        if (publicEdgeNodes.length < MAX_PUBLIC) {
                            publicEdgeNodes = await setupPublicEdgeNode(req, publicEdgeNodes);
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

setupPublicEdgeNode = async function (req, publicEdgeNodes) {
    const maxNodeId = await req.getModel('PublicEdgeNode').max('nodeId') || 2499;
    const edgeNodeId = Number(maxNodeId) + 1;
    const edgeNode = await got(tfuel_stake_host + '/edgeNode/start/' + edgeNodeId);
    if (JSON.parse(edgeNode.body).Summary) {
        let publicEdgeNode = await req.getModel('PublicEdgeNode').build();
        publicEdgeNode.nodeId = edgeNodeId;
        publicEdgeNode.summary = await JSON.parse(edgeNode.body).Summary;
        await publicEdgeNode.save();
    }
    return await req.getModel('PublicEdgeNode').findAll();
}

module.exports = {
    register: publicEdgeNode,
    name: 'publicEdgeNode',
    version: '1.0.0'
};