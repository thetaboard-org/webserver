const Boom = require('@hapi/boom')

const artist = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        const artists = await req.getModel('Artist').findAll();
                        let response = {"data": []};
                        artists.forEach(artist => {
                            response.data.push(artist.toJSON());
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
                        const artist = await req.getModel('Artist').findOne({where: {'id': req.params.id}});
                        let response = {"data": {}};
                        response.data = artist.toJSON();
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
    register: artist,
    name: 'artist',
    version: '1.0.0'
};