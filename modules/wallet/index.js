const Boom = require('@hapi/boom')
const jwt = require('../utils/jwt')

const wallet = function (server, options, next) {
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
                        let wallet = await req.getModel('Wallet').build(req.payload.data.attributes);
                        wallet.userId = user.id;
                        const saved = await wallet.save();
                        await setDefault(saved, req);
                        const response = {
                            data: {
                                id: saved.id,
                                type: 'wallet',
                                attributes: {
                                    "user-id": saved.userId,
                                    "address": saved.address,
                                    "is-default": saved.isDefault,
                                    "name": saved.name
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
                        const wallets = await req.getModel('Wallet').findAll({where: {'userId': user.id}});
                        let response = {"data": []};
                        wallets.forEach(wallet => {
                            response.data.push({
                                id: wallet.id,
                                type: 'wallet',
                                attributes: {
                                    "user-id": wallet.userId,
                                    "address": wallet.address,
                                    "is-default": wallet.isDefault,
                                    "name": wallet.name
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
                        const wallet = await req.getModel('Wallet').findOne({where: {'id': req.params.id}});
                        if (!wallet) {
                            throw "Wallet not found";
                        }
                        if (wallet.userId != user.id) {
                            throw "Not authorized";
                        }

                        wallet.isDefault = req.payload.data.attributes.isDefault;
                        const saved = await wallet.save();
                        await setDefault(saved, req);
                        const response = {
                            data: {
                                id: saved.id,
                                type: 'wallet',
                                attributes: {
                                    "user-id": saved.userId,
                                    "address": saved.address,
                                    "is-default": saved.isDefault,
                                    "name": saved.name
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
            path: '/{id}',
            method: 'DELETE',
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
                        const wallet = await req.getModel('Wallet').findOne({where: {'id': req.params.id}});
                        if (!wallet) {
                            throw "Wallet not found";
                        }
                        if (wallet.userId != user.id) {
                            throw "Not authorized";
                        }
                        wallet.destroy();
                        return null;
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        }
    ]);
};

const setDefault = async function (defaultWallet, req) {
    if (!defaultWallet.isDefault) {
        return;
    }
    const wallets = await req.getModel('Wallet').findAll({where: {'userId': defaultWallet.userId}});
    wallets.forEach((wallet) => {
        if (wallet.id == defaultWallet.id) {
            wallet.isDefault = true;
        } else {
            wallet.isDefault = false;
        }
        wallet.save();
    });
    return wallets;
}

module.exports = {
    register: wallet,
    name: 'wallet',
    version: '1.0.0'
};