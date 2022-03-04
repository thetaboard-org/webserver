const {Document} = require("flexsearch");
const {ethers} = require("ethers");

const explorer = require('../explorer');

// init contract
const marketplace_abi = require("../../abi/marketplace_abi.json");
const marketplace_addr = "0x533c8425897b3E10789C1d6F576b96Cb55E6F47d";
const provider = new ethers.providers.JsonRpcProvider("https://eth-rpc-api.thetatoken.org/rpc");
const marketplaceContract = new ethers.Contract(marketplace_addr, marketplace_abi, provider);

const facets = ['artist', 'priceRange', 'category', 'drop'];
const priceRanges = [[0, 49], [50, 249], [250, 999], [1000, 9999], [10000, "Infinity"]];
const categories = [{id: 0, name: 'TNS'}, {id: 1, name: 'Art'}];

//init index
const indexFields = ["name", "description",
    "properties:artist:name", "properties:artist:bio",
    "properties:drop:name", "properties:drop:description"];

const index = new Document({
    document: {
        id: "properties:selling_info:itemId",
        index: indexFields,
        tag: "tags",
    },
    tokenize: "forward",
})


// Make a singleton;
async function initStructure(server) {
    const sequelize = server.plugins["hapi-sequelizejs"].thetaboard;
    const sellingItems = await marketplaceContract.fetchSellingItems();

    const indexTNT721 = (tnt721, itemId) => {
        index.allNFTSIndex[itemId] = index.allNFTs.push(tnt721) - 1;
        index.totalCount++;

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
                const facet = index[facetName][id];
                // update name and increment sells
                index[facetName][id] = {
                    'name': tnt721.properties[facetName].name,
                    sellingItems: facet ? facet.sellingItems++ : 1
                };
                tnt721.tags.push(`${facetName}:${id}`);
            }
        });

        if (tnt721.contract_addr === '0xBB4d339a7517c81C32a01221ba51CBd5d3461A94') {
            tnt721.tags.push(`category:0`);
        } else {
            tnt721.tags.push(`category:1`);
        }

        index.addAsync(tnt721);
    }

    const eventHandler = async (itemId, nftContract, tokenId, seller, buyer, category, price, isSold, event) => {
        // if it is a new item we add it;
        const tnt721 = await explorer.get_nft_info_721(nftContract, tokenId.toString(), itemId, sequelize);
        if (!isSold) {
            indexTNT721(tnt721, itemId);
        } else {
            // otherwise we remove it
            index.allNFTs.splice(index.allNFTSIndex[itemId], 1);
            delete index.allNFTSIndex[itemId];
            index.totalCount--;
            index.removeAsync(itemId);

            ['artist', 'drop'].forEach((facetName) => {
                if (tnt721.properties[facetName]) {
                    const id = tnt721.properties[facetName].id
                    const facet = index[facetName][id];
                    // update name and increment sells
                    if (facet && facet.sellingItems === 1) {
                        delete index[facetName][id];
                    }
                    index[facetName][id] = {
                        'name': tnt721.properties[facetName].name,
                        sellingItems: facet ? facet.sellingItems-- : 1
                    };
                }
            });
        }
    }

    marketplaceContract.on("MarketItemCreated", eventHandler);

    marketplaceContract.on("MarketItemSale", eventHandler);


    // get all NFTs infos and load them in memory
    index.totalCount = 0;
    index.allNFTSIndex = {};
    index.allNFTs = [];
    index.artist = {};
    index.drop = {};
    index.priceRanges = priceRanges;
    index.facetsParams = facets;
    index.categories = categories;

    await Promise.all(sellingItems.map(async (x) => {
        if (!x.isSold) {
            const tnt721 = await explorer.get_nft_info_721(x.nftContract, x.tokenId.toString(), x.itemId, sequelize);
            // if nft is not valid, do not show
            if (!tnt721) {
                return;
            }
            indexTNT721(tnt721, x.itemId);
        }
    }));
    return index;
}

module.exports = {
    initStructure: initStructure,
}