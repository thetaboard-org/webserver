const Boom = require('@hapi/boom')
const marketplaceData = require('./dataStructure')

const marketplace = async function (server, options, next) {
    // init marketplace data structure/search engine
    server.ext("onPostStart", async () => {
        marketplaceData.initStructure(server);
    });

    server.route([
        {
            path: '/facets',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const artists = await req.getModel('Artist').findAll();
                    const drops = await req.getModel('Drop').findAll({where: {isPublic: true}});
                    return {
                        priceRanges: marketplaceData.facets.priceRanges.map((x) => x.join('|')),
                        categories: marketplaceData.facets.categories,
                        artists: artists,
                        drops: drops
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
                    const marketplaceCollection = server.mongo.db.collection('marketplace');
                    const cursor = marketplaceCollection.find()

                    if (sortBy) {
                        const sort = {"properties.selling_info.price": orderBy === "desc" ? -1 : 1}
                        cursor.sort(sort).collation({locale: "en_US", numericOrdering: true});
                    }

                    try {
                        const count = await marketplaceCollection.count();
                        const sellingNFTs = await cursor.skip((pageNumber - 1) * showPerPage).limit(showPerPage).toArray();
                        return {
                            totalCount: count,
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

                    const marketplaceCollection = server.mongo.db.collection('marketplace');

                    const filter = {}

                    marketplaceData.facets.types.forEach((facet) => {
                        if (req.query[facet]) {
                            if (!filter['$and']) {
                                filter['$and'] = [];
                            }
                            const or = req.query[facet].split(',').map((x) => {
                                return {"tags": `${facet}:${x}`}
                            })
                            filter["$and"].push({"$or": or})
                        }
                    })
                    if (search) {
                        filter['$text'] = {"$search": search};
                    }

                    const cursor = marketplaceCollection.find(filter)
                    if (sortBy) {
                        const sort = {"properties.selling_info.price": orderBy === "desc" ? -1 : 1}
                        cursor.sort(sort).collation({locale: "en_US", numericOrdering: true});
                    } else if(search){
                        cursor.sort({score: {$meta: 'textScore'}});
                    } else {
                        const sort = {dateAdded: 1}
                        cursor.sort(sort)
                    }

                    try {
                        const count = await marketplaceCollection.count(filter);
                        const sellingNFTs = await cursor.skip((pageNumber - 1) * showPerPage).limit(showPerPage).toArray();
                        return {
                            totalCount: count,
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
            path: '/newlyAdded',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const marketplaceCollection = server.mongo.db.collection('marketplace');
                    return marketplaceCollection.find().sort({"dateAdded": 1}).limit(20);
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