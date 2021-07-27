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

            {
                plugin: require('hapi-sequelizejs'),
                options: [
                    {
                        name: 'thetaboard', // identifier
                        models: [__dirname + '/models/**/*.js'], // paths/globs to model files
                        ignoredModels: [__dirname + '/models/index.js'], // OPTIONAL: paths/globs to ignore files
                        sequelize: new Sequelize('thetaboard', secrets.database.user, process.env.MYSQL_PASS, {
                            host: process.env.DB,
                            dialect: 'mariadb'
                        }), // sequelize instance
                        sync: true, // sync models - default false
                    },
                ],
            },
            {
                plugin: './explorer',
                routes: {
                    prefix: '/explorer'
                }
            },
            {
                plugin: './auth',
                routes: {
                    prefix: '/auth'
                }
            },
            {
                plugin: './user',
                routes: {
                    prefix: '/users'
                }
            },
            {
                plugin: './guardian',
                routes: {
                    prefix: '/guardian'
                }
            },
            {
                plugin: './tfuelstake',
                routes: {
                    prefix: '/tfuelstakes'
                }
            },
            {
                plugin: './publicEdgeNode',
                routes: {
                    prefix: '/public-edge-nodes'
                }
            },
            {
                plugin: './wallet',
                routes: {
                    prefix: '/wallets'
                }
            },
            {
                plugin: './group',
                routes: {
                    prefix: '/groups'
                }
            },
            {
                plugin: './affiliate',
                routes: {
                    prefix: '/affiliates'
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
