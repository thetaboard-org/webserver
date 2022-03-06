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
                        priceRanges: marketplaceIndex.priceRanges.map((x) => x.join('|')),
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
                    const sortBy = req.query.sortBy ? req.query.sortBy : ""; // only work for price for now
                    const orderBy = req.query.orderBy ? req.query.orderBy : "";

                    let allNfts;
                    if (sortBy) {
                        allNfts = [...marketplaceIndex.allNFTs].sort((x, y) => {
                            return x.properties.selling_info.price - y.properties.selling_info.price;
                        });
                        if (orderBy && orderBy.toLowerCase() === 'desc') {
                            allNfts = allNfts.reverse();
                        }
                    } else {
                        allNfts = marketplaceIndex.allNFTs
                    }
                    try {
                        const sellingNFTs = allNfts.slice((pageNumber - 1) * showPerPage, showPerPage + (pageNumber - 1) * showPerPage);
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
                    const sortBy = req.query.sortBy ? req.query.sortBy : ""; // only work for price for now
                    const orderBy = req.query.orderBy ? req.query.orderBy : "";
                    const showPerPage = 20;
                    const mktIdx = marketplaceIndex;

                    const usedFacets = [];
                    if (search) {
                        usedFacets.push("search");
                    }
                    const tags = mktIdx.facetsParams.map((facetName) => {
                        if (req.query[facetName]) {
                            usedFacets.push(facetName);
                            return req.query[facetName].split(',').map((x) => `${facetName}:${x}`);
                        } else {
                            return []
                        }
                    }).flat();

                    const searchResults = mktIdx.search(search, {tag: tags, limit: 500});
                    if (search && tags.length !== 0) {
                        // if "search" is present we need to doa  second search to get the tags information
                        searchResults.push(...mktIdx.search({tag: tags, limit: 500}));
                    }
                    const searchResultsFlat = searchResults.reduce((acc, val) => acc.concat(val.result), []);
                    let searchResultsUnique = [...new Set(searchResultsFlat)];

                    // implement an AND filter for top level facets
                    if (usedFacets.length > 1) {
                        // todo this is a n2 operation which is not the best...
                        searchResultsUnique = searchResultsUnique.filter((result) => {
                            // the result need to be present in at least one of each of the facets used
                            const presentInFacets = [];
                            searchResults.forEach((tagResult) => {
                                let facet;
                                if (tagResult.tag) {
                                    facet = tagResult.tag.split(':')[0];
                                } else {
                                    facet = 'search';
                                }
                                if (presentInFacets.includes(facet)) {
                                    // do nothing
                                } else if (tagResult.result.includes(result)) {
                                    presentInFacets.push(facet)
                                }
                            })
                            return presentInFacets.length === usedFacets.length;
                        });
                    }

                    // populate with Objects
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
                        const sellingNFTs = searchResultsObjects.slice((pageNumber - 1) * showPerPage, showPerPage + (pageNumber - 1) * showPerPage);
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