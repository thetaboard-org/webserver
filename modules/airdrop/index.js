const Boom = require('@hapi/boom')

const airdrop = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        const artistId = req.query.artistId;
                        const pageNumber = req.query.pageNumber ? Number(req.query.pageNumber) : 1;
                        const sortBy = req.query.sortBy ? req.query.sortBy : "id";
                        const showPerPage = 6;
                        const options = {where: {}};
                        if (pageNumber) {
                            options.limit = showPerPage;
                            options.offset = (pageNumber - 1) * showPerPage;
                        }
                        if (sortBy) {
                            options.order = [[sortBy, "ASC"]]
                        }
                        if(artistId){
                            options.where.artistId = artistId;
                        }
                        const airdrops = await req.getModel('Airdrop').findAll(options);

                        const response = {"data": []};
                        response.data = airdrops.map(airdrop => {
                            const airdropJSON = airdrop.toJSON();
                            airdropJSON.relationships = {
                                artist: {
                                    data: {"type": "artist", "id": airdrop.artistId}
                                },
                                "gift-nft": {
                                    data: {"type": "nft", "id": airdrop.giftNftId}
                                },
                                "source-nft": {
                                    data: {"type": "nft", "id": airdrop.sourceNftId}
                                }
                            }
                            return airdropJSON;
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
                        const airdrop = await req.getModel('Airdrop').findOne(
                            {where: {'id': req.params.id}});
                        const response = {"data": {}};
                        const airdropJSON = airdrop.toJSON();
                        airdropJSON.relationships = {
                            artist: {
                                data: {"type": "artist", "id": airdrop.artistId}
                            },
                            giftNftId: {
                                data: {"type": "nft", "id": airdrop.giftNftId}
                            },
                            sourceNftId: {
                                data: {"type": "nft", "id": airdrop.sourceNftId}
                            }
                        }
                        response.data = airdropJSON;

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
                        const current_user = await req.getModel('User').findOne(
                            {where: {'email': req.auth.credentials.email}});
                        const artist = await req.getModel('Artist').findOne({
                            where: {'id': req.payload.data.attributes.artistId},
                        });
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            artist.userId === current_user.id)) {
                            return Boom.unauthorized();
                        }

                        const airdrop = await req.getModel('Airdrop').findOne(
                            {where: {'id': req.params.id}});

                        // update attributes
                        const attributes = req.payload.data.attributes;
                        for (const attr in attributes) {
                            airdrop[attr] = attributes[attr];
                        }
                        await airdrop.save()

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
                        const artist = await req.getModel('Artist').findOne({
                            where: {'id': req.payload.data.attributes.artistId},
                        });
                        // check if authorized
                        if (!(req.auth.credentials.scope === 'Admin' ||
                            artist.userId === current_user.id)) {
                            return Boom.unauthorized();
                        }
                        const airdrop = req.getModel('Airdrop').build(req.payload.data.attributes);
                        await airdrop.save()

                        return {"data": airdrop.toJSON()};
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