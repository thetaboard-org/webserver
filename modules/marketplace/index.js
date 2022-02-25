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
            path: '/facets',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const artists = Object.entries(marketplaceIndex.artist).map((x) => {
                        x[1].id = x[0];
                        return x[1]
                    });
                    const drops = Object.entries(marketplaceIndex.drop).map((x) => {
                        x[1].id = x[0];
                        return x[1]
                    });
                    return {
                        artists: artists,
                        drops: drops,
                        priceRanges: marketplaceIndex.priceRanges,
                        categories: marketplaceIndex.categories
                    }
                }
            }
        },
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const pageNumber = req.query.pageNumber ? req.query.pageNumber : 1;
                    const showPerPage = 20;
                    try {
                        const sellingNFTs = marketplaceIndex.allNFTs.slice((pageNumber - 1) * showPerPage, showPerPage + pageNumber * showPerPage);
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
        },
        {
            path: '/search',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const pageNumber = req.query.pageNumber ? req.query.pageNumber : 1;
                    const search = req.query.search ? req.query.search : "";
                    const sortBy = req.query.sortBy ? req.query.sortBy : "";
                    const orderBy = req.query.orderBy ? req.query.orderBy : "";
                    const showPerPage = 20;
                    const mktIdx = marketplaceIndex;

                    const tags = mktIdx.facetsParams.map((facetName) => {
                        return req.query[facetName] ? req.query[facetName].split(',').map((x) => `${facetName}:${x}`) : [];
                    }).flat();

                    const searchResults = mktIdx.search(search, {tag: tags, limit: 500});
                    // all
                    const searchResultsFlat = searchResults.reduce((acc, val) => acc.concat(val.result), []);
                    const searchResultsUnique = [...new Set(searchResultsFlat)];

                    let searchResultsObjects = searchResultsUnique.map((x) => mktIdx.allNFTs[mktIdx.allNFTSIndex[x]]);

                    if (sortBy) {
                        searchResultsObjects = searchResultsObjects.sort((x, y) => {
                            return x.properties.selling_info.price - y.properties.selling_info.price;
                        });
                        if (orderBy && orderBy.toLowerCase() === 'desc') {
                            searchResultsObjects = searchResultsObjects.reverse();
                        }
                    }
                    try {
                        const sellingNFTs = searchResultsObjects.slice((pageNumber - 1) * showPerPage, showPerPage + pageNumber * showPerPage);
                        return {
                            totalCount: searchResultsObjects.length,
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