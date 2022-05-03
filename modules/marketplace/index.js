const Boom = require('@hapi/boom')

const marketplaceRoute = async function (server, options, next) {
    server.route([
        {
            path: '/facets',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    const artists = await req.getModel('Artist').findAll();
                    const drops = await req.getModel('Drop').findAll({where: {isPublic: true}});
                    const marketplace = server.app.marketplace;
                    return {
                        priceRanges: marketplace.facets.priceRanges.map((x) => x.join('|')),
                        categories: marketplace.facets.categories,
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
                    const nftCollection = server.hmongoose.connection.models.nft;
                    const cursor = nftCollection.find({
                        "tnt721.properties.selling_info.itemId": {
                            $exists: true,
                            $ne: null
                        }
                    })

                    if (sortBy) {
                        const sort = {"tnt721.properties.selling_info.price": orderBy === "desc" ? -1 : 1}
                        cursor.sort(sort).collation({locale: "en_US", numericOrdering: true});
                    } else {
                        const sort = {"tnt721.properties.selling_info.itemId": -1}
                        cursor.sort(sort);
                    }

                    try {
                        const count = await nftCollection.count({
                            "tnt721.properties.selling_info.itemId": {
                                $exists: true,
                                $ne: null
                            }
                        });
                        const sellingNFTs = await cursor.skip((pageNumber - 1) * showPerPage).limit(showPerPage);
                        return {
                            totalCount: count,
                            sellingNFTs: sellingNFTs.map((x) => x.tnt721)
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

                    const marketplace = server.app.marketplace;
                    const nftCollection = server.hmongoose.connection.models.nft;

                    const filter = {}

                    marketplace.facets.types.forEach((facet) => {
                        if (req.query[facet]) {
                            if (!filter['$and']) {
                                filter['$and'] = [];
                            }
                            const or = req.query[facet].split(',').map((x) => {
                                return {"tnt721.properties.selling_info.tags": `${facet}:${x}`}
                            })
                            filter["$and"].push({"$or": or})
                        }
                    })
                    if (search) {
                        filter['$text'] = {"$search": search};
                    }

                    const cursor = nftCollection.find(filter)
                    if (sortBy) {
                        const sort = {"tnt721.properties.selling_info.price": orderBy === "desc" ? -1 : 1}
                        cursor.sort(sort).collation({locale: "en_US", numericOrdering: true});
                    } else if (search) {
                        cursor.sort({score: {$meta: 'textScore'}});
                    } else {
                        const sort = {"tnt721.properties.selling_info.itemId": -1}
                        cursor.sort(sort).collation({locale: "en_US", numericOrdering: true});
                    }

                    try {
                        const count = await nftCollection.count(filter);
                        const sellingNFTs = await cursor.skip((pageNumber - 1) * showPerPage).limit(showPerPage);
                        return {
                            totalCount: count,
                            sellingNFTs: sellingNFTs.map((x) => x.tnt721)
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
                    const nftCollection = server.hmongoose.connection.models.nft;
                    const cursor = nftCollection.find({
                        "tnt721.properties.selling_info.itemId": {
                            $exists: true,
                            $ne: null
                        }
                    });

                    const newly = await cursor.sort({"properties.selling_info.itemId": -1});
                    return newly.map((x) => x.tnt721);
                }
            }
        }
    ]);
};


module.exports = {
    register: marketplaceRoute,
    name: 'marketplace',
    version: '1.0.0'
};