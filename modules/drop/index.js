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
                            drop.relationships = {};
                            drop.relationships = { 
                                artist: {
                                    data: { "type": "artist", "id": rawDrop.artistId }
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
                        let drop = rawDrop.toJSON();
                        drop.relationships = { 
                            artist: {
                                data: { "type": "artist", "id": rawDrop.artistId }
                            }
                        }
                        response.data.push(drop);
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
    register: drop,
    name: 'drop',
    version: '1.0.0'
};