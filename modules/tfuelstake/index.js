const Boom = require('@hapi/boom')
const got = require('got');

const tfuel_stake_host = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' ? "http://localhost:8002" : "http://147.135.65.57:8002";

const tfuelstake = function (server, options, next) {
    server.route([
        {
            method: 'POST',
            path: '/',
            options: {
                auth: {
                    strategy: 'token',
                },
                handler: async (req, h) => {
                    try {
                        const user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        if (!user) {
                            throw "User not found";
                        }
                        //create edge node
                        const EN = await setupPrivateEdgeNode(req, user)

                        // do not block, but add rewards to it
                        const en_addr = EN.summary.slice(0, 42);
                        got(`http://142.44.213.241:8002/edgeNode/write_key?EN_SERVER=${tfuel_stake_host}/edgeNode&EN_ID=${EN.edgeNodeId}`)
                            .then(() => {
                                return got(`http://142.44.213.241:8002/edgeNode/do_split?EN_ADDR=${en_addr}&EN_ID=${EN.edgeNodeId}&REWARD_ADDR=0xa078C2852eb6e455f97EeC21e39F8ef24173Df60&SPLIT_REWARD=300`)
                            }).then(() => {
                            EN.splitRewards = true;
                            return EN.save();
                        });
                        // this return happen before split is done
                        return {"data": EN.toJSON()};
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        },
        {
            method: 'GET',
            path: '/',
            options: {
                auth: {
                    strategy: 'token',
                },
                handler: async (req, h) => {
                    try {
                        const user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        if (!user) {
                            throw "User not found";
                        }
                        const tfuelstakes = await req.getModel('Tfuelstake').findAll({where: {'userId': user.id}});
                        return {"data": tfuelstakes.map(stake => stake.toJSON())};
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        },
        {
            path: '/{id}',
            method: 'PATCH',
            options: {
                auth: {
                    strategy: 'token',
                },
                handler: async function (req, h) {
                    try {
                        const user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        if (!user) {
                            throw "User not found";
                        }
                        const tfuelstake = await req.getModel('Tfuelstake').findOne({where: {'id': req.params.id}});
                        if (!tfuelstake) {
                            throw "Stake not found";
                        }
                        if (tfuelstake.userId != user.id) {
                            throw "Not authorized";
                        }

                        if (tfuelstake.status == 'staking') {
                            tfuelstake.status = 'unstaked';
                        } else if (tfuelstake.status == 'staked') {
                            tfuelstake.status = 'unstaking';
                        } else if (tfuelstake.status == 'unstaking') {
                            tfuelstake.status = 'staked';
                        }

                        const saved = await tfuelstake.save();
                        return {"data": tfuelstake.toJSON()};
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        },
        {
            method: 'GET',
            path: '/all',
            options: {
                auth: {
                    strategy: 'token',
                    scope: 'Admin'
                },
                handler: async (req, h) => {
                    try {
                        const user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        if (!user) {
                            throw "User not found";
                        }
                        const tfuelstakes = await req.getModel('Tfuelstake').findAll();
                        return {"data": tfuelstakes.map(stake => stake.toJSON())};
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


setupPrivateEdgeNode = async function (req, user) {
    const maxNodeId = await req.getModel('Tfuelstake').max('edgeNodeId') || 0;
    const edgeNodeId = Number(maxNodeId) + 1;
    let edgeNode;
    let summary;
    try {
        edgeNode = await got(tfuel_stake_host + '/edgeNode/start/' + (edgeNodeId));
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
    const tfuelstake = await req.getModel('Tfuelstake').build(req.payload.data.attributes);
    tfuelstake.userId = user.id;
    tfuelstake.edgeNodeId = edgeNodeId;
    tfuelstake.summary = summary;
    await tfuelstake.save();
    return tfuelstake
}


module.exports = {
    register: tfuelstake,
    name: 'tfuelstake',
    version: '1.0.0'
};