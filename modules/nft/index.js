const Boom = require("@hapi/boom");

const NIFTIES = function (server, options, next) {
    server.route([
        {
            method: 'get',
            path: '/{NFT_NAME}/{NFT_ID}',
            options: {
                handler: async (req, h) => {
                    try {
                        return {
                            "image": "https://thetaboard.io/assets/img/thetaboard-logo.png",
                            "name": "Thetaboard Early Adopter",
                            "description": "This badge was created for early adopters of the thetaboard community!"
                        }
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        }])
}

module.exports = {
    register: NIFTIES,
    name: 'nifties',
    version: '1.0.0'
};