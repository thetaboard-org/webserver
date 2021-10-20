const Boom = require('@hapi/boom')

const drop = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        const drops = await req.getModel('Drop').findAll();
                        let response = {"data": []};
                        drops.forEach(rawDrop => {
                            let drop = rawDrop.toJSON();
                            drop.relationships = {
                                artist: {
                                    data: {"type": "artist", "id": rawDrop.artistId}
                                }
                            }
                            response.data.push(drop);
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
                            (drop.dataValues.Artist.userId === current_user.id &&
                                drop.dataValues.Artist.id === Number(req.payload.data.relationships.artist.data.id)))) {
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
                        // check is authorized
                        if (req.auth.credentials.scope !== 'Admin') {
                            // check if drop is created for the current artist
                            return Boom.unauthorized();
                        }
                        const drop = req.getModel('Drop').build(req.payload.data.attributes);
                        await drop.save()
                        return {"data": drop.toJSON()};
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