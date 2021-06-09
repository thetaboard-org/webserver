const Moment = require('moment');
const Jwt = require('@hapi/jwt');
const secrets = require('../../config/secrets.json')

const TTL = 60 * 60 * 24; //24hours

exports.validate = (artifacts, request, h) => {
    // Check token timestamp
    const diff = Moment().diff(Moment(artifacts.decoded.payload.exp * 1000));
    if (diff < 0) { //check how long is left on the token
        return {
            isValid: true,
            credentials: {email: artifacts.decoded.payload.email}
        };
    } else {
        return {
            isValid: false
        };
    }
};


exports.createToken = (user) => {
    return Jwt.token.generate(
        {
            aud: 'urn:audience:thetaboard_user',
            iss: 'urn:issuer:thetaboard',
            email: user.email,
            scope: user.scope
        },
        {
            key: secrets.jwt.secret_key,
            algorithm: 'HS512'
        },
        {
            ttlSec: TTL
        }
    );
}