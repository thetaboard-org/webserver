const Boom = require('@hapi/boom')

const nft = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        const nfts = [];
                        if (req.query.artistId) {
                            nfts = await req.getModel('NFT').findAll({where: {'artistId': req.query.artistId}});
                        } else if (req.query.dropId) {
                            nfts = await req.getModel('NFT').findAll({where: {'dropId': req.query.dropId}});
                        } else {
                            nfts = await req.getModel('NFT').findAll();
                        }
                        let response = {"data": []};
                        nfts.forEach(rawNFT => {
                            let nft = rawNFT.toJSON();
                            nft.relationships = {};
                            nft.relationships = { 
                                artist: {
                                    data: { "type": "artist", "id": rawNFT.artistId }
                                },
                                drop: {
                                    data: { "type": "drop", "id": rawNFT.dropId }
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
                        const rawNFT = await req.getModel('NFT').findOne({where: {'id': req.params.id}});
                        let response = {"data": {}};
                        let drop = rawNFT.toJSON();
                        drop.relationships = { 
                            artist: {
                                data: { "type": "artist", "id": rawNFT.artistId }
                            },
                            drop: {
                                data: { "type": "drop", "id": rawNFT.dropId }
                            }
                        }
                        response.data = drop;
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
    register: nft,
    name: 'nft',
    version: '1.0.0'
};