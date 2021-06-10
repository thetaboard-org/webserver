const bcrypt = require('bcrypt');
const Boom = require('@hapi/boom')
const email = require('../utils/email')
const jwt = require('../utils/jwt')

const saltRounds = 10;

const user = function (server, options, next) {
    server.route([{
        path: '/get_all',
        method: 'GET',
        handler: async (req, h) => {
            const users = await req.getModel('User').findAll();
            return h.response(users);
        }
    },
        {
            method: 'POST',
            path: '/',
            handler: async (req, h) => {
                try {
                    const user = await req.getModel('User').build(req.payload.data.attributes);
                    if (!user.password) {
                        throw "Password missing";
                    }
                    user.password = await bcrypt.hash(req.payload.data.attributes.password, saltRounds);
                    const saved = await user.save();
                    email.sentMailVerificationLink(user, jwt.createToken(saved));
                    const response = {
                        data: {
                            id: saved.id,
                            type: 'user',
                            attributes: {
                                email: saved.email,
                                "is-verified": saved.isVerified
                            }
                        }
                    }
                    return response;
                } catch (e) {
                    if (e && e.errors) {
                        e = e.errors[0].message;
                    }
                    return Boom.badRequest(e);
                }
            }
        },
        {
            method: 'POST',
            path: '/send_email_verification',
            options: {
                auth: {
                    strategy: 'token',
                },
                handler: async (req, h) => {
                    try {
                        const user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        if (!user) {
                            throw "Email address not registered";
                        }
                        email.sentMailVerificationLink(user, jwt.createToken(user));
                        const response = {
                            data: {
                                id: user.id,
                                type: 'user',
                                attributes: {
                                    email: user.email,
                                    "is-verified": user.isVerified
                                }
                            }
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
            path: '/verify_email',
            method: 'GET',
            options: {
                auth: {
                    strategy: 'token',
                },
                handler: async function (request, h) {
                    try {
                        const user = await request.getModel('User').findOne({where: {'email': request.auth.credentials.email}});
                        if (!user) {
                            throw "An error occured";
                        }
                        user.isVerified = true;
                        const saved = await user.save();
                        const response = {
                            data: {
                                id: saved.id,
                                type: 'user',
                                attributes: {
                                    email: saved.email,
                                    "is-verified": saved.isVerified
                                }
                            }
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
            method: 'POST',
            path: '/reset_password',
            handler: async (req, h) => {
                try {
                    const body = JSON.parse(req.payload);
                    if (!body) {
                        return {};
                    }
                    const user = await req.getModel('User').findOne({where: {'email': body.email}});
                    if (!user || !user.email) {
                        return {};
                    }
                    email.sentMailForgotPassword(user, jwt.createToken(user));
                    return {};
                } catch (e) {
                    return Boom.badRequest('');
                }
            }
        },
        {
            path: '/password_reset',
            method: 'POST',
            options: {
                auth: {
                    strategy: 'token',
                },
                handler: async function (req, h) {
                    try {
                        const body = JSON.parse(req.payload);
                        if (body && body.password && req.auth.credentials.email) {        
                            const user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                            if(!user) {
                                throw "An error occured";
                            }
                            user.password = await bcrypt.hash(body.password, saltRounds);
                            const saved = await user.save();
                            const response = {
                                data: {
                                    id: saved.id,
                                    type: 'user',
                                    attributes: {
                                        email: saved.email,
                                        "is-verified": saved.isVerified
                                    }
                                }
                            };
                            return response;
                        } else {
                            throw "Link invalid";
                        }
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
                auth: {
                    strategy: 'token',
                },
                handler: async function (request, h) {
                    try {
                        const user = await request.getModel('User').findOne({where: {'id': request.params.id}});
                        const response = {
                            data: {
                                id: user.id,
                                type: 'user',
                                attributes: {
                                    email: user.email,
                                    "is-verified": user.isVerified
                                }
                            }
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
    ]);
};


module.exports = {
    register: user,
    name: 'user',
    version: '1.0.0'
};