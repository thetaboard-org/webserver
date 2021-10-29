const Boom = require('@hapi/boom')

const nft = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        let nfts;
                        if (req.query.artistId) {
                            nfts = await req.getModel('NFT').findAll({
                                where:
                                    {'artistId': req.query.artistId}, include: 'NFTAsset'
                            });
                        } else if (req.query.dropId) {
                            nfts = await req.getModel('NFT').findAll({
                                where: {'dropId': req.query.dropId},
                                include: 'NFTAsset'
                            });
                        } else {
                            nfts = await req.getModel('NFT').findAll({include: 'NFTAsset'});
                        }
                        let response = {"data": []};
                        response.data = nfts.map(rawNFT => {
                            const nft = rawNFT.toJSON();
                            nft.relationships = {
                                artist: {
                                    data: {"type": "artist", "id": rawNFT.artistId}
                                },
                                drop: {
                                    data: {"type": "drop", "id": rawNFT.dropId}
                                },
                                NFTAsset: rawNFT.NFTAsset.map(x => x.toJSON())
                            };
                            return nft;
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
                        const rawNFT = await req.getModel('NFT').findOne({where: {'id': req.params.id}});
                        let response = {"data": {}};

                        if (rawNFT) {
                            let nft = rawNFT.toJSON();
                            nft.relationships = {
                                artist: {
                                    data: {"type": "artist", "id": rawNFT.artistId}
                                },
                                drop: {
                                    data: {"type": "drop", "id": rawNFT.dropId}
                                }
                            }
                            const rawNFTAssets = await req.getModel('NFTAsset').findAll({where: {'nftId': nft.id}});
                            if (rawNFTAssets.length) {
                                nft.relationships["nft-assets"] = {
                                    data: rawNFTAssets.map((nftAsset) => ({"type": "nft-asset", "id": nftAsset.id}))
                                };
                            }
                            response.data = nft;
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
            method: 'PATCH',
            options: {
                auth: {
                    strategy: 'token',
                    scope: ['Admin', 'Creator']
                },
                handler: async function (req, h) {
                    try {
                        const current_user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        const NFT = await req.getModel('NFT').findByPk(req.params.id, {
                            include: "Artist"
                        });
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            (NFT.Artist.userId === current_user.id &&
                                NFT.Artist.id === req.payload.data.artistId))) {
                            return Boom.unauthorized();
                        }

                        // update attributes
                        const attributes = req.payload.data.attributes;
                        for (const attr in attributes) {
                            NFT[attr] = attributes[attr];
                        }
                        await NFT.save()
                        return {"data": NFT.toJSON()};
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
                        const drop = await req.getModel('Drop').findByPk(
                            req.payload.data.attributes.dropId,
                            {include: ['Artist']});
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            drop.Artist.userId === current_user.id)) {
                            return Boom.unauthorized();
                        }

                        const nft = req.getModel('NFT').build(req.payload.data.attributes);
                        nft.artistId = drop.Artist.id;
                        await nft.save()
                        return {"data": nft.toJSON()};
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
    register: nft,
    name: 'nft',
    version: '1.0.0'
};