const bcrypt = require("bcrypt");
const Boom = require('@hapi/boom')

const secrets = require("../../config/secrets.json")
const jwt = require("../utils/jwt")

const auth = function (server, options, next) {
    // JWT strategy
    server.auth.strategy('token', 'jwt', {
        validate: jwt.validate,
        verify: {
            aud: 'urn:audience:thetaboard_user',
            iss: 'urn:issuer:thetaboard',
            sub: false,
        },
        keys: secrets.jwt.secret_key,

    });

    server.route({
        method: 'POST',
        path: '/login',
        options: {
            handler: async function (request, h) {
                try {
                    if (!request.payload.password || !request.payload.email) {
                        throw "error.no_empty_email_password";
                    }
                    const user = await request.getModel('User').findOne({where: {'email': request.payload.email}});
                    if (!user) {
                        throw "error.incorrect_email_password";
                    }
                    const isSame = await bcrypt.compare(request.payload.password, user.password);
                    if (!isSame) {
                        throw "error.incorrect_email_password";
                    }
                    const token = jwt.createToken(user);
                    return {"token": token}
                } catch (error) {
                    return Boom.badRequest(error);
                }

            }
        }
    });

    server.route({
        method: 'GET',
        path: '/secure',
        options: {
            auth: {
                strategy: 'token',
            },
            handler: function (request, h) {
                return "yes"

            }
        }
    });

}


module.exports = {
    register: auth,
    name: 'auth',
    version: '1.0.0'
};