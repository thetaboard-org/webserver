const Boom = require('@hapi/boom')
const jwt = require('../utils/jwt')

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
                        let tfuelstake = await req.getModel('Tfuelstake').build(req.payload.data.attributes);
                        tfuelstake.userId = user.id;
                        const saved = await tfuelstake.save();
                        const response = {
                            data: {
                                id: saved.id,
                                type: 'tfuelstake',
                                attributes: {
                                    "user-id": saved.userId,
                                    "wallet-address": saved.walletAddress,
                                    "stake-amount": saved.stakeAmount,
                                    "status": saved.status,
                                    "created-at": saved.createdAt,
                                }
                            }
                        }
                        return response;
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
                        let response = {"data": []};
                        tfuelstakes.forEach(stake => {
                            response.data.push({
                                id: stake.id,
                                type: 'tfuelstake',
                                attributes: {
                                    "user-id": stake.userId,
                                    "wallet-address": stake.walletAddress,
                                    "stake-amount": stake.stakeAmount,
                                    "status": stake.status,
                                    "created-at": stake.createdAt,
                                }
                            });
                          });
                        return response;
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
                        const response = {
                            data: {
                                id: saved.id,
                                type: 'tfuelstake',
                                attributes: {
                                    "user-id": saved.userId,
                                    "wallet-address": saved.walletAddress,
                                    "stake-amount": saved.stakeAmount,
                                    "status": saved.status,
                                    "created-at": saved.createdAt,
                                }
                            }
                        }
                        return response;
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


module.exports = {
    register: tfuelstake,
    name: 'tfuelstake',
    version: '1.0.0'
};