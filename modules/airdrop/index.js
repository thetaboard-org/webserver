const Boom = require('@hapi/boom')

const airdrop = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        let airdrops;
                        if (req.query) {
                            airdrops = await req.getModel('Airdrop').findAll({where: req.query});
                        } else {
                            airdrops = await req.getModel('Airdrop').findAll();
                        }
                        const response = {"data": []};
                        response.data = airdrops.map(airdrop => {
                            return airdrop.toJSON();
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
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        const airdrop = await req.getModel('Airdrop').findOne({where: {'id': req.params.id}});
                        let response = {"data": {}};
                        response.data = airdrop.toJSON();
                        return response;
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        }, {
            path: '/{id}',
            method: 'PATCH',
            options: {
                auth: {
                    strategy: 'token',
                    scope: ['Admin', 'Creator']
                },
                handler: async function (req, h) {
                    try {
                        const current_user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        const airdrop = await req.getModel('Airdrop').findOne({where: {'id': req.params.id}});
                        // check is authorized
                        if (req.auth.credentials.scope !== 'Admin' &&
                            (airdrop.dataValues.userId !== current_user.id ||
                                airdrop.dataValues.userId !== req.payload.data.attributes.userId)) {
                            return Boom.unauthorized();
                        }

                        // update attributes
                        const attributes = req.payload.data.attributes;
                        for (const attr in attributes) {
                            airdrop[attr] = attributes[attr];
                        }
                        await airdrop.save()

                        // update NFT collection cache
                        const nftCollection = server.hmongoose.connection.models.nft;
                        for (const NFT of await airdrop.getNFTs()) {
                            if (NFT.nftContractId) {
                                nftCollection.updateForContract(NFT.nftContractId);
                            }
                        }

                        let response = {"data": {}};
                        response.data = airdrop.toJSON();
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
            path: '/',
            method: 'POST',
            options: {
                auth: {
                    strategy: 'token',
                    scope: ['Admin', 'Creator']
                },
                handler: async function (req, h) {
                    try {
                        const current_user = await req.getModel('User').findOne(
                            {where: {'email': req.auth.credentials.email}});
                        // check is authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            (req.auth.credentials.scope === 'Creator'
                                && req.payload.data.attributes.userId === current_user.id))) {
                            return Boom.unauthorized();
                        }
                        const airdrop = req.getModel('airdrop').build(req.payload.data.attributes);
                        await airdrop.save()

                        // update NFT collection cache
                        const nftCollection = server.hmongoose.connection.models.nft;
                        for (const NFT of await airdrop.getNFTs()) {
                            if (NFT.nftContractId) {
                                nftCollection.updateForContract(NFT.nftContractId);
                            }
                        }

                        return {"data": airdrop.toJSON()};
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
                    scope: ['Admin', 'Creator']
                },
                handler: async function (req, h) {
                    try {
                        const current_user = await req.getModel('User').findOne(
                            {where: {'email': req.auth.credentials.email}});
                        const airdrop = await req.getModel('Airdrop').findOne(
                            {where: {'id': req.params.id}});
                        // check is authorized
                        if (req.auth.credentials.scope !== 'Admin' &&
                            (airdrop.dataValues.userId !== current_user.id ||
                                airdrop.dataValues.userId !== req.payload.data.attributes.userId)) {
                            return Boom.unauthorized();
                        }
                        await airdrop.destroy();
                        return h.response({}).code(204);
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


module.exports = {
    register: airdrop,
    name: 'airdrop',
    version: '1.0.0'
};