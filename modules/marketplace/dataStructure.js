const {Document} = require("flexsearch");
const {ethers} = require("ethers");

const explorer = require('../explorer');

// init contract
const marketplace_abi = require("../../abi/marketplace_abi.json");
const marketplace_addr = "0x533c8425897b3E10789C1d6F576b96Cb55E6F47d";
const provider = new ethers.providers.JsonRpcProvider("https://eth-rpc-api.thetatoken.org/rpc");
const marketplaceContract = new ethers.Contract(marketplace_addr, marketplace_abi, provider);

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

    const indexTNT721 = (tnt721, itemId)=>{
        index.allNFTSIndex[itemId] = index.allNFTs.push(tnt721) - 1;
        index.totalCount++;
        tnt721.tags = [];

        if (tnt721.properties.artist) {
            const artist = index.artists[tnt721.properties.artist.id];
            // if already on index
            // update name and increment sells
            index.artists[tnt721.properties.artist.id] = {
                'name': tnt721.properties.artist.name,
                sellingItems: artist ? artist.sellingItems++ : 1
            };
            tnt721.tags.push(tnt721.properties.artist.id);
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
            if (tnt721.properties.artist) {
                const artist = index.artists[tnt721.properties.artist.id];
                // if already on index
                // update name and increment sells
                if (artist.sellingItems === 1) {
                    delete index.artists[tnt721.properties.artist.id];
                } else {
                    index.artists[tnt721.properties.artist.id] = {
                        'name': tnt721.properties.artist.name,
                        sellingItems: artist ? artist.sellingItems-- : 1
                    };
                }
            }
        }
    }

    marketplaceContract.on("MarketItemCreated", eventHandler);

    marketplaceContract.on("MarketItemSale", eventHandler);


    // get all NFTs infos and load them in memory
    index.totalCount = 0;
    index.allNFTSIndex = {};
    index.allNFTs = [];
    index.artists = {};
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