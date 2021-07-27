const Boom = require('@hapi/boom')
const jwt = require('../utils/jwt')

const group = function (server, options, next) {
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
                        let group = await req.getModel('Group').build(req.payload.data.attributes);
                        group.userId = user.id;
                        const saved = await group.save();

                        if (req.payload.data.relationships && req.payload.data.relationships.wallets) {
                            const wallets = req.payload.data.relationships.wallets.data.map(wallet => wallet.id);
                            await saved.addWallets(wallets);
                        }
                        await setDefault(saved, req);
                        const response = {
                            data: {
                                id: saved.id,
                                type: 'group',
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
                        const WalletModel = await req.getModel('Wallet');
                        const groups = await req.getModel('Group').findAll({
                            where: {'userId': user.id},
                            include: WalletModel 
                        });
                        let response = {"data": []};
                        groups.forEach((group) => {
                            console.log()
                            const data = {
                                id: group.id,
                                type: 'group',
                                attributes: {
                                    "user-id": group.userId,
                                    "is-default": group.isDefault,
                                    "name": group.name
                                }
                            };
                            if (group.Wallets.length) {
                                data.relationships = {
                                    wallets: {
                                        data: group.Wallets.map((x) => ({ "type": "wallet", "id": x.id }))    
                                    }
                                }
                            }
                            response.data.push(data);
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
                        const group = await req.getModel('Group').findOne({where: {'id': req.params.id}});
                        if (!group) {
                            throw "Group not found";
                        }
                        if (group.userId != user.id) {
                            throw "Not authorized";
                        }

                        group.isDefault = req.payload.data.attributes.isDefault;
                        const saved = await group.save();
                        await setDefault(saved, req);
                        const response = {
                            data: {
                                id: saved.id,
                                type: 'group',
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
                        const group = await req.getModel('Group').findOne({where: {'id': req.params.id}});
                        if (!group) {
                            throw "Group not found";
                        }
                        if (group.userId != user.id) {
                            throw "Not authorized";
                        }
                        group.destroy();
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

const setDefault = async function (defaultGroup, req) {
    if (!defaultGroup.isDefault) {
        return;
    }
    const groups = await req.getModel('Group').findAll({where: {'userId': defaultGroup.userId}});
    groups.forEach((group) => {
        if (group.id == defaultgroup.id) {
            group.isDefault = true;
        } else {
            group.isDefault = false;
        }
        group.save();
    });
    const wallets = await req.getModel('Wallet').findAll({where: {'userId': defaultWallet.userId}});
    wallets.forEach((wallet) => {
        wallet.isDefault = false;
        wallet.save();
    });

    return groups;
}

module.exports = {
    register: group,
    name: 'group',
    version: '1.0.0'
};