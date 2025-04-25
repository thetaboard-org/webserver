const Glue = require('@hapi/glue');
const Path = require('path');
const Sequelize = require('sequelize');
const secrets = require("./config/secrets.json")
const services = require("./services");
const {promises: fs} = require("fs");

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
                        sync: false, // sync models - default false
                    },
                ],
            },
            {
                plugin: require('@y-io/hapi-mongoose'),
                options: {
                    connString: `mongodb://${secrets.database.user}:${secrets.database.password}@${process.env.MONGO || "mongo"}:${process.env.MONGO_PORT || 27017}/thetaboard?authSource=admin`,
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
                plugin: './airdrop',
                routes: {
                    prefix: '/api/airdrops'
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

    // Log request errors
    server.events.on('request', (request, event, tags) => {
        if (tags.error) {
            console.error(`Request error: ${event.error ? event.error.message : 'unknown'}`, {
                method: request.method,
                path: request.path,
                payload: request.payload,
                query: request.query,
                headers: request.headers,
            });
        }
    });

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

    // init models and services
    server.ext("onPostStart", async () => {
        // register models
        const connection = server.hmongoose.connection;
        for (const model of await fs.readdir("./models_mongo")) {
            const modelName = model.split('.')[0];
            const mongooseModel = require(`./models_mongo/${modelName}`);
            const modelInstance = new mongooseModel(server);
            connection.model(modelName, modelInstance);
        }
        console.log("Initialized models")

        // init services
        for (const [serviceName, service] of Object.entries(services)) {
            server.app[serviceName] = new service(server);
        }
        console.log("Initialized services")
    });

    // Handle unhandled promise rejections and exceptions
    process.on('unhandledRejection', (reason, promise) => {
        console.error("Unhandled rejection in:", promise);
        console.error("Unhandled Rejection:", reason);
    });

    process.on('uncaughtException', (err) => {
        console.error("Uncaught Exception:", err);
    });

    try {
        await server.start();
        console.log('Server running at: %s://%s:%s', server.info.protocol, server.info.address, server.info.port);
    } catch (err) {
        console.error("Error starting server:", err);
        process.exit(1);
    }
};

init();
