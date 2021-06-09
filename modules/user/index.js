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
                const user = await req.getModel('User').build(req.payload.user);
                user.password = await bcrypt.hash(req.payload.user.password, saltRounds);
                try {
                    const saved = await user.save();
                    email.sentMailVerificationLink(user, jwt.createToken(saved));
                    return {'success': true};
                } catch (e) {
                    return Boom.badRequest(e);
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
                    const user = await request.getModel('User').findOne({where: {'email': request.auth.credentials.email}});
                    user.isVerified = true;
                    return user;
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