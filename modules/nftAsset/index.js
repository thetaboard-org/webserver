const Boom = require('@hapi/boom')

const nftAsset = function (server, options, next) {
    server.route([
        {
            path: '/{id}',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        const rawNftAsset = await req.getModel('NFTAsset').findOne({where: {'id': req.params.id}});
                        let response = {"data": {}};
                        if (rawNftAsset) {
                            let nftAsset = rawNftAsset.toJSON();
                            response.data = nftAsset;
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
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        if (!req.query.nftId) {
                            return Boom.badRequest("Must pass nftId as query params");
                        }
                        const rawNftAssets = await req.getModel('NFTAsset').findAll({where: {'nftId': req.query.nftId}});
                        return {"data": rawNftAssets.map((x) => x.toJSON())};
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
                    scope: ['Admin', 'Creator']
                },
                handler: async function (req, h) {
                    try {
                        const current_user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        const NFTasset = await req.getModel('NFTAsset').findByPk(req.params.id, {
                            include: ["NFT"]
                        });
                        const artist = await NFTasset.NFT.getArtist();
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            (artist.userId === current_user.id))) {
                            return Boom.unauthorized();
                        }

                        // update attributes
                        const attributes = req.payload.data.attributes;
                        for (const attr in attributes) {
                            NFTasset[attr] = attributes[attr];
                        }
                        await NFTasset.save()
                        return {"data": NFTasset.toJSON()};
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
                        const current_user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        const NFT = await req.getModel('NFT').findByPk(
                            req.payload.data.attributes.nftId,
                            {include: ['Artist']});
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            NFT.Artist.userId === current_user.id)) {
                            return Boom.unauthorized();
                        }

                        const asset = req.getModel('NFTAsset').build(req.payload.data.attributes);
                        await asset.save()
                        return {"data": asset.toJSON()};
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
                        const NFT = await req.getModel('NFT').findByPk(req.params.id, {
                            include: "Artist"
                        });
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            (NFT.Artist.userId === current_user.id &&
                                NFT.Artist.id === req.payload.data.artistId))) {
                            return Boom.unauthorized();
                        }
                        return await NFT.destroy();
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
    register: nftAsset,
    name: 'nftAsset',
    version: '1.0.0'
};