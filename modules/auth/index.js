const Moment = require('moment');
const Jwt = require('@hapi/jwt');
const bcrypt = require("bcrypt");

const TTL = 60 * 60 * 24; //24hours


const validate = (artifacts, request, h) => {
    // Check token timestamp
    const diff = Moment().diff(Moment(artifacts.decoded.payload.exp * 1000));
    if (diff < 0) { //check how long is left on the token
        return {
            isValid: true,
            credentials: {userName: artifacts.decoded.payload.user}
        };
    }else{
        return {
            isValid: false
        };
    }
};


/**
 * @param {*} user
 */
function createToken(user) {
    //TODO add scope to it
    return Jwt.token.generate(
        {
            aud: 'urn:audience:thetaboard_user',
            iss: 'urn:issuer:thetaboard',
            user: user.userName,
        },
        {
            key: 'random_key', //TODO add to config
            algorithm: 'HS512'
        },
        {
            ttlSec: TTL
        }
    );

}

const auth = function (server, options, next) {
    /**
     * Register 'google' authentication strategy
     */
    server.auth.strategy('google', 'bell', {
        provider: 'google',
        password: 'cookie_encryption_password_secure',
        isSecure: process.env.NODE_ENV === 'production',
        clientId: '1012666492630-k6173ufjl9iucaku8hvdnf44ubhrpvk1.apps.googleusercontent.com',
        clientSecret: 'vvPAYlblV3B02qTvNAPLIYas', //TODO: add to config file,
        location: process.env.NODE_ENV === 'production' ? 'https://thetaboard.io' : 'http://localhost:8000'
    });

    // JWT strategy
    server.auth.strategy('token', 'jwt', {
        validate: validate,
        verify: {
            aud: 'urn:audience:thetaboard_user',
            iss: 'urn:issuer:thetaboard',
            sub: false,
        },
        keys: "random_key", //TODO: add private key,

    });

    server.route({
        method: 'POST',
        path: '/login',
        options: {
            handler: async function (request, h) {
                const user = await request.getModel('User').findOne({where: {'userName': request.payload.userName}});
                if (!user) {
                    return {'success': false, error: "UserName does not exists"}
                }
                const isSame = await bcrypt.compare(request.payload.password, user.password);
                if (!isSame) {
                    return {'success': false, error: "Wrong password"}
                }
                return {'success': true, "token": createToken(user)}
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/google',
        options: {
            auth: {
                strategy: 'google',
                mode: 'try'
            },
            handler: function (request, h) {

                if (!request.auth.isAuthenticated) {
                    return 'Authentication failed due to: ' + request.auth.error.message;
                }

                return '<pre>' + JSON.stringify(request.auth.credentials, null, 4) + '</pre>';
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
                if (!request.auth.isAuthenticated) {
                    return 'None'
                } else {
                    return "yes"
                }
            }
        }
    });

}


module.exports = {
    register: auth,
    name: 'auth',
    version: '1.0.0'
};