const {ethers} = require("ethers");

const explorer = require('../modules/explorer');

// init contract
const marketplace_abi = require("../abi/marketplace_abi.json");
const marketplace_addr = "0x533c8425897b3E10789C1d6F576b96Cb55E6F47d";
const provider = new ethers.providers.JsonRpcProvider("http://142.44.213.241:18888/rpc");
const marketplaceContract = new ethers.Contract(marketplace_addr, marketplace_abi, provider);

const facets = ['artist', 'priceRange', 'category', 'drop'];
const priceRanges = [[0, 49], [50, 249], [250, 999], [1000, 9999], [10000, "Infinity"]];
const categories = [{id: 0, name: 'TNS'}, {id: 1, name: 'Art'}];


const indexTNT721 = async (tnt721, marketplaceCollection) => {
    // add tags and indexes
    tnt721.tags = [];

    const priceTfuel = ethers.utils.formatEther(tnt721.properties.selling_info.price);
    if (priceTfuel <= priceRanges[0][1]) {
        tnt721.tags.push(`priceRange:${priceRanges[0].join('|')}`);
    } else if (priceTfuel <= priceRanges[1][1]) {
        tnt721.tags.push(`priceRange:${priceRanges[1].join('|')}`);
    } else if (priceTfuel <= priceRanges[2][1]) {
        tnt721.tags.push(`priceRange:${priceRanges[2].join('|')}`);
    } else if (priceTfuel <= priceRanges[3][1]) {
        tnt721.tags.push(`priceRange:${priceRanges[3].join('|')}`);
    } else {
        tnt721.tags.push(`priceRange:${priceRanges[4].join('|')}`);
    }

    ['artist', 'drop'].forEach((facetName) => {
        if (tnt721.properties[facetName]) {
            const id = tnt721.properties[facetName].id
            tnt721.tags.push(`${facetName}:${id}`);
        }
    });

    if (tnt721.contract_addr.toLowerCase() === '0xbb4d339a7517c81c32a01221ba51cbd5d3461a94') {
        tnt721.tags.push(`category:0`);
    } else {
        tnt721.tags.push(`category:1`);
    }

    tnt721.dateAdded = new Date();
    await marketplaceCollection.updateOne(
        {"properties.selling_info.itemId": tnt721.properties.selling_info.itemId},
        {"$set": tnt721},
        {upsert: true});
}

// Make a singleton;
async function initStructure(server) {
    const sequelize = server.plugins["hapi-sequelizejs"].thetaboard;
    const marketplaceCollection = server.mongo.db.collection('marketplace');

    //Create Index
    try {
        marketplaceCollection.createIndex({"properties.selling_info.seller": 1});
        marketplaceCollection.createIndex({"properties.selling_info.itemId": -1});
        marketplaceCollection.createIndex({"tags": 1});
        marketplaceCollection.createIndex({
                "name": "text",
                "description": "text",
                "properties.artist.name": "text",
                "properties.artist.bio": "text",
                "properties.drop.name": "text",
                "properties.drop.description": "text"
            },
            {
                weights: {
                    "name": 10,
                    "description": 5,
                    "properties.artist.name": 8,
                    "properties.artist.bio": 3,
                    "properties.drop.name": 8,
                    "properties.drop.description": 3
                },
                name: "TextIndex"
            });
    } catch (e) {
        // do nothing if index already exists
    }

    const sellingItems = await marketplaceContract.fetchSellingItems();


    const eventHandler = async (itemId, nftContract, tokenId, seller, buyer, category, price, isSold, event) => {
        // if it is a new item we add it;
        const tnt721 = await explorer.get_nft_info_721(nftContract, tokenId.toString(), itemId, sequelize);
        if (!isSold) {
            console.log("Adding new item to marketplace : ", Number(itemId.toString()));
            await indexTNT721(tnt721, marketplaceCollection);
        } else {
            console.log("Removing item from marketplace : ", Number(itemId.toString()));
            marketplaceCollection.deleteOne({"properties.selling_info.itemId": Number(itemId.toString())});
        }
    }

    marketplaceContract.on("MarketItemCreated", eventHandler);

    marketplaceContract.on("MarketItemSale", eventHandler);

    const item_ids = sellingItems.map((x) => Number(x.itemId));

    const result = await marketplaceCollection.deleteMany({"properties.selling_info.itemId": {"$nin": item_ids}});
    console.log("Deleted " + result.deletedCount + " item from marketplace");
    const to_index = await marketplaceCollection.aggregate([{
        $match: {
            "properties.selling_info.itemId": {
                $in: item_ids
            }
        }
    },
        {
            $group: {
                _id: null,
                found: {
                    "$addToSet": "$properties.selling_info.itemId"
                }
            }
        },
        {
            "$addFields": {
                fullList: item_ids
            }
        },
        {
            "$addFields": {
                notfound: {
                    "$setDifference": [
                        "$fullList",
                        "$found"
                    ]
                }
            }
        }
    ]).toArray();
    await Promise.all(sellingItems.map(async (x) => {
        if (!x.isSold && (to_index.length === 0 || to_index["0"].notfound.includes(x.itemId.toNumber()))) {
            const tnt721 = await explorer.get_nft_info_721(x.nftContract, x.tokenId.toString(), x.itemId, sequelize);
            // if nft is not valid, do not show
            if (!tnt721) {
                return;
            }
            return indexTNT721(tnt721, marketplaceCollection);
        }
    }));
    console.log(`Done initializing marketplace`);
}

async function updateNFTInfo(req, nft) {
    const marketplaceCollection = req.mongo.db.collection('marketplace');
    const sellingItems = await marketplaceCollection.find({contract_addr: nft.nftContractId.toLowerCase()}).toArray();
    sellingItems.map(async (x) => {
        const tnt721 = await explorer.get_nft_info_721(x.contract_addr, x.original_token_id, x.properties.selling_info.itemId, req);
        if (!tnt721) {
            return;
        }
        return indexTNT721(tnt721, marketplaceCollection);
    })
    // if nft is not valid, do not show

}

module.exports = {
    initStructure: initStructure,
    updateInfo: updateNFTInfo,
    facets: {types: facets, priceRanges: priceRanges, categories: categories}
}