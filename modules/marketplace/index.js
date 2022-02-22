const Boom = require('@hapi/boom')
const marketplaceData = require('./dataStructure')

const marketplace = async function (server, options, next) {
    // init marketplace data structure/search engine
    let marketplaceIndex;
    server.ext("onPostStart", async () => {
        marketplaceIndex = await marketplaceData.initStructure(server);
    });

    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const pageNumber = req.query.pageNumber ? req.query.pageNumber : 1;
                    const showPerPage = 20;
                    try {
                        const sellingNFTs = marketplaceIndex.allNFTs.slice((pageNumber - 1) * showPerPage, showPerPage + pageNumber * showPerPage);
                        const artists = Object.entries(marketplaceIndex.artists).map((x) => {
                            x[1].id = x[0];
                            return x[1]
                        });
                        return {
                            totalCount: marketplaceIndex.totalCount,
                            artists: artists,
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
        },
        {
            path: '/search',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const pageNumber = req.query.pageNumber ? req.query.pageNumber : 1;
                    const search = req.query.search ? req.query.search : "";
                    const artistsTags = req.query.artists ? req.query.artists.split(',') : [];
                    const showPerPage = 20;
                    const mktIdx = marketplaceIndex;
                    const searchResults = mktIdx.search(search, {tag: artistsTags, limit: 500});
                    const searchResultsFlat = searchResults.reduce((acc, val) => acc.concat(val.result), []);
                    const searchResultsUnique = [...new Set(searchResultsFlat)];

                    const searchResultsObjects = searchResultsUnique.map((x) => mktIdx.allNFTs[mktIdx.allNFTSIndex[x]]);
                    try {
                        const sellingNFTs = searchResultsObjects.slice((pageNumber - 1) * showPerPage, showPerPage + pageNumber * showPerPage);
                        const artists = Object.entries(marketplaceIndex.artists).map((x) => {
                            x[1].id = x[0];
                            return x[1]
                        });
                        return {
                            totalCount: searchResultsObjects.length,
                            artists: artists,
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