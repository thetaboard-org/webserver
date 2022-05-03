const Boom = require('@hapi/boom');
const {Op} = require('sequelize')


const drop = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        const pageNumber = req.query.pageNumber ? Number(req.query.pageNumber) : 1;
                        const sortBy = req.query.sortBy ? req.query.sortBy : "endDate";
                        const showPerPage = 6;
                        const options = {where: {}};
                        const today = new Date();

                        if (req.query.isLive) {
                            options.where.startDate = {
                                [Op.lte]: today
                            };
                            options.where.endDate = {
                                [Op.gte]: today
                            }
                        } else if (req.query.isEnded) {
                            options.where.endDate = {
                                [Op.lte]: today
                            }
                        } else if (req.query.isComing) {
                            options.where[Op.or] =
                                [{
                                    startDate: {
                                        [Op.gte]: today
                                    }
                                }, {isDeployed: false}]

                        }
                        if (req.query.isPublic) {
                            options.where.isPublic = req.query.isPublic;
                        }
                        if (req.query.isSponsored) {
                            options.where.isSponsored = req.query.isSponsored
                        }
                        if (pageNumber) {
                            options.limit = showPerPage;
                            options.offset = (pageNumber - 1) * showPerPage;
                        }
                        if (sortBy) {
                            options.order = [[sortBy, "ASC"]]
                        }
                        if (req.query.artistId) {
                            options.where.artistId = req.query.artistId;
                        }
                        const drops = await req.getModel('Drop').findAll(options);
                        const drops_count = await req.getModel('Drop').count(options);

                        return {
                            "meta": {"total": drops_count},
                            "data": await Promise.all(drops.map(async rawDrop => {
                                const drop = rawDrop.toJSON();
                                const rawNFTs = await req.getModel('NFT').findAll({where: {'dropId': rawDrop.id}});
                                drop.relationships = {
                                    artist: {
                                        data: {"type": "artist", "id": rawDrop.artistId}
                                    },
                                    nfts: {
                                        data: rawNFTs.map((nft) => ({"type": "nft", "id": nft.id}))
                                    }
                                }
                                return drop;
                            }))
                        };
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
                        const rawDrop = await req.getModel('Drop').findOne({where: {'id': req.params.id}});
                        let response = {"data": {}};

                        if (rawDrop) {
                            let drop = rawDrop.toJSON();
                            drop.relationships = {
                                artist: {
                                    data: {"type": "artist", "id": rawDrop.artistId}
                                }
                            }
                            const rawNFTs = await req.getModel('NFT').findAll({where: {'dropId': drop.id}});
                            if (rawNFTs.length) {
                                drop.relationships.nfts = {
                                    data: rawNFTs.map((nft) => ({"type": "nft", "id": nft.id}))
                                };
                            }
                            response.data = drop;
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
                        const drop = await req.getModel('Drop').findOne({
                            where: {'id': req.params.id},
                            include: "Artist"
                        });
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            (drop.Artist.userId === current_user.id &&
                                drop.Artist.id === Number(req.payload.data.relationships.artist.data.id)))) {
                            return Boom.unauthorized();
                        }

                        // update attributes
                        const attributes = req.payload.data.attributes;
                        for (const attr in attributes) {
                            drop[attr] = attributes[attr];
                        }
                        drop.artistId = req.payload.data.relationships.artist.data.id;
                        await drop.save()
                        const dropJSON = drop.toJSON();
                        dropJSON.relationships = {
                            artist: {
                                data: {"type": "artist", "id": req.payload.data.relationships.artist.data.id}
                            }
                        }

                        // update NFT collection cache
                        const nftCollection = server.hmongoose.connection.models.nft;
                        for (const NFT of await drop.getNFTs()) {
                            if (NFT.nftContractId) {
                                nftCollection.updateForContract(NFT.nftContractId);
                            }
                        }

                        return {"data": dropJSON};
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
                        const artist = await req.getModel('Artist').findOne({
                            where: {'id': req.payload.data.relationships.artist.data.id},
                        });
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            artist.userId === current_user.id)) {
                            return Boom.unauthorized();
                        }

                        const drop = req.getModel('Drop').build(req.payload.data.attributes);
                        drop.artistId = req.payload.data.relationships.artist.data.id;
                        await drop.save()

                        // update NFT collection cache
                        const nftCollection = server.hmongoose.connection.models.nft;
                        for (const NFT of await drop.getNFTs()) {
                            if (NFT.nftContractId) {
                                nftCollection.updateForContract(NFT.nftContractId);
                            }
                        }

                        return {"data": drop.toJSON()};
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
                        const current_user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        const drop = await req.getModel('Drop').findOne({
                            where: {'id': req.params.id},
                            include: "Artist"
                        });
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            (drop.Artist.userId === current_user.id &&
                                drop.Artist.id === Number(req.payload.data.relationships.artist.data.id)))) {
                            return Boom.unauthorized();
                        }
                        await drop.destroy();
                        return h.response({}).code(204)
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
    register: drop,
    name: 'drop',
    version: '1.0.0'
};