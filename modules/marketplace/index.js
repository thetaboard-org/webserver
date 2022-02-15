const Boom = require('@hapi/boom')
const marketplaceData = require('./dataStructure')

const marketplace = function (server, options, next) {
    // init marketplace data structure/search engine
    marketplaceData.initStructure(server)

    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        marketplaceData.findAll();

                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        }
    ]);
};


module.exports = {
    register: marketplace,
    name: 'marketplace',
    version: '1.0.0'
};