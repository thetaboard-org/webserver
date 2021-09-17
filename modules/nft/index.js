const Boom = require("@hapi/boom");
const IDS = require("./ids")

const NIFTIES = function (server, options, next) {
    server.route([
            {
                method: 'get',
                path: '/{NFT_NAME}/{NFT_ID}',
                options: {
                    handler: async (req, h) => {
                        try {
                            return {
                                "image": "https://nft.thetaboard.io/nft/assets/thetaboard/early_adopter.png",
                                "name": "Thetaboard Early Adopter",
                                "description": "This badge was created for early adopters of the thetaboard community!",
                                "token_id": IDS[req.params.NFT_ID]
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
                method: 'GET',
                path: '/assets/{param*}',
                options: {
                    handler: function (req, h) {

                        return h.file(__dirname + "/assets/" + req.params.param, {
                            confine: false
                        });
                    },
                }
            }
        ]
    )
}

// Run the wallet listener
const {Worker} = require('worker_threads');

function runWorker(path) {
    const worker = new Worker(path);
    worker.on('message', console.log);
    worker.on('error', console.error);
    worker.on('exit', (exitCode) => {
        runWorker(path)
    });
    return worker;
}

runWorker(`${__dirname}/listeners/listen_and_mint.js`);


module.exports = {
    register: NIFTIES,
    name: 'nifties',
    version: '1.0.0'
};

