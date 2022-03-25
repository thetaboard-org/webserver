const Glue = require('@hapi/glue');
const Path = require('path');
const Sequelize = require('sequelize');
const secrets = require("./config/secrets.json")

// Server port
const HTTP_PORT = process.env.PORT || 8000;

const manifest = {
    "server": {
        "port": HTTP_PORT,
        routes: {
            files: {
                relativeTo: Path.join(__dirname, 'public')
            }
        }
    },
    "register": {
        "plugins": [
            '@hapi/inert', // static files
            '@hapi/bell', // oauth with third party
            '@hapi/cookie', //session in cookies
            '@hapi/jwt', // auth with jwt,
            'hapijs-status-monitor', // monitoring on /status route,
            {
                plugin: require('laabr'),// logging
                options: {
                    formats: {
                        'log': '{ message::message, timestamp::time[iso], level::level, environment::environment }',
                        'request': '{ message::message, timestamp::time[iso], level::level, environment::environment }',
                        'request-error': '{ error::error, timestamp::time[iso], level::level, environment::environment }',
                        'response': ':time[iso] :method :remoteAddress :url :status (:responseTime ms)',
                        'uncaught': '{ error::error, timestamp::time[iso], level::level, environment::environment, source::error[source] }'
                    },
                    indent: 0
                }
            },
            {
                plugin: require('hapi-sequelizejs'),
                options: [
                    {
                        name: 'thetaboard', // identifier
                        models: [__dirname + '/models/**/*.js'], // paths/globs to model files
                        ignoredModels: [__dirname + '/models/index.js'], // OPTIONAL: paths/globs to ignore files
                        sequelize: new Sequelize('thetaboard', secrets.database.user, secrets.database.password, {
                            host: process.env.DB || "maria",
                            dialect: 'mariadb',
                            port: process.env.DB_PORT || 3306,
                            dialectOptions: {
                                options: {
                                    requestTimeout: 3000
                                }
                            },
                            pool: {
                                max: 100,
                                min: 5,
                                acquire: 60000,
                                idle: 10000
                            }
                        }), // sequelize instance
                        sync: true, // sync models - default false
                    },
                ],
            },
            {
              plugin: require('hapi-mongodb'),
              options: {
                  url: `mongodb://${secrets.database.user}:${secrets.database.password}@${process.env.MONGO || "mongo"}:${process.env.MONGO_PORT || 27017}/thetaboard`,
                  decorate: true
              }
            },
            {
                plugin: './explorer',
                routes: {
                    prefix: '/api/explorer'
                }
            },
            {
                plugin: './auth',
                routes: {
                    prefix: '/api/auth'
                }
            },
            {
                plugin: './user',
                routes: {
                    prefix: '/api/users'
                }
            },
            {
                plugin: './guardian',
                routes: {
                    prefix: '/api/guardian'
                }
            },
            {
                plugin: './tfuelstake',
                routes: {
                    prefix: '/api/tfuelstakes'
                }
            },
            {
                plugin: './publicEdgeNode',
                routes: {
                    prefix: '/api/public-edge-nodes'
                }
            },
            {
                plugin: './wallet',
                routes: {
                    prefix: '/api/wallets'
                }
            },
            {
                plugin: './group',
                routes: {
                    prefix: '/api/groups'
                }
            },
            {
                plugin: './affiliate',
                routes: {
                    prefix: '/api/affiliates'
                }
            },
            {
                plugin: './transactionHistory',
                routes: {
                    prefix: '/api/transaction-histories'
                }
            },
            {
                plugin: './transactionExport',
                routes: {
                    prefix: '/api/transaction-exports.csv'
                }
            },
            {
                plugin: './coinbaseHistory',
                routes: {
                    prefix: '/api/coinbase-histories'
                }
            },
            {
                plugin: './nifties',
                routes: {
                    prefix: '/nft' // Can t change to /api/nft because our NFTs smartcontract point to it....
                }
            },
            {
                plugin: './nft',
                routes: {
                    prefix: '/api/nfts'
                }
            },
            {
                plugin: './drop',
                routes: {
                    prefix: '/api/drops'
                }
            },
            {
                plugin: './artist',
                routes: {
                    prefix: '/api/artists'
                }
            },
            {
                plugin: './nftAsset',
                routes: {
                    prefix: '/api/nft-assets'
                }
            },
            {
                plugin: './tnsTokenId',
                routes: {
                    prefix: '/api/tns-token-ids'
                }
            },
            {
                plugin: './marketplace',
                routes: {
                    prefix: '/api/marketplace'
                }
            }
        ]
    }
}

const options = {
    relativeTo: __dirname + '/modules'
};

const init = async () => {
    const server = await Glue.compose(manifest, options);


    // TODO: these routes probably shouldn't be there
    // deliver assets
    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                lookupCompressed: true,
                path: './',
            }
        }
    });
    // // default 404 to be handled by ember
    server.ext('onPreResponse', (request, h) => {
        const response = request.response;
        if (response.isBoom &&
            response.output.statusCode === 404) {
            return h.file('index.html');
        }
        return h.continue;
    });

    await server.start();
    console.log('Server running at: %s://%s:%s', server.info.protocol, server.info.address, server.info.port);
}

init();
