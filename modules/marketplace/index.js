const Boom = require('@hapi/boom')
const marketplaceData = require('./dataStructure')

const marketplace = async function (server, options, next) {
    // init marketplace data structure/search engine
    const marketplaceIndex = await marketplaceData.initStructure(server)

    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const pageNumber = req.query.pageNumber ? req.query.pageNumber : 1;
                    const showPerPage = 20;
                    try {
                        const sellingNFTs = marketplaceIndex.allNFTs.splice((pageNumber - 1) * showPerPage, pageNumber * showPerPage);
                        return {
                            totalCount: marketplaceIndex.totalCount,
                            sellingNFTs: sellingNFTs
                        }
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