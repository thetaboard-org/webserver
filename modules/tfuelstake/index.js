const Boom = require('@hapi/boom')

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
                        return {"data": saved.toJSON()};
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
    ]);
};


module.exports = {
    register: tfuelstake,
    name: 'tfuelstake',
    version: '1.0.0'
};