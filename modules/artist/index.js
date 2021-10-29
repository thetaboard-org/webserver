const Boom = require('@hapi/boom')

const artist = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        let artists;
                        if (req.query) {
                            artists = await req.getModel('Artist').findAll(req.query);
                        } else {
                            artists = await req.getModel('Artist').findAll();
                        }
                        const response = {"data": []};
                        response.data = artists.map(artist => {
                            return artist.toJSON();
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
                        const artist = await req.getModel('Artist').findOne({where: {'id': req.params.id}});
                        // check is authorized
                        if (req.auth.credentials.scope !== 'Admin' &&
                            (artist.dataValues.userId !== current_user.id ||
                                artist.dataValues.userId !== req.payload.data.attributes.userId)) {
                            return Boom.unauthorized();
                        }

                        // update attributes
                        const attributes = req.payload.data.attributes;
                        for (const attr in attributes) {
                            artist[attr] = attributes[attr];
                        }
                        await artist.save()
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
        {
            path: '/',
            method: 'POST',
            options: {
                auth: {
                    strategy: 'token',
                    scope: ['Admin', 'Creator']
                },
                handler: async function (req, h) {
                    // Only admins can create a new artist
                    try {
                        const current_user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        // check is authorized
                        if (req.auth.credentials.scope !== 'Admin') {
                            return Boom.unauthorized();
                        }
                        const artist = req.getModel('Artist').build(req.payload.data.attributes);
                        await artist.save()
                        return {"data": artist.toJSON()};
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
                        const artist = await req.getModel('Artist').findOne(
                            {where: {'id': req.params.id}});
                        // check is authorized
                        if (req.auth.credentials.scope !== 'Admin' &&
                            (artist.dataValues.userId !== current_user.id ||
                                artist.dataValues.userId !== req.payload.data.attributes.userId)) {
                            return Boom.unauthorized();
                        }

                        return await artist.destroy();
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
    register: artist,
    name: 'artist',
    version: '1.0.0'
};