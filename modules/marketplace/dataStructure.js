const {Document} = require("flexsearch");
const {ethers} = require("ethers");

const explorer = require('../explorer');

// init contract
const marketplace_abi = require("../../abi/marketplace_abi.json");
const marketplace_addr = "0x533c8425897b3E10789C1d6F576b96Cb55E6F47d";
const provider = new ethers.providers.JsonRpcProvider("https://eth-rpc-api.thetatoken.org/rpc");
const marketplaceContract = new ethers.Contract(marketplace_addr, marketplace_abi, provider);

const TNSaddress =  "0xBB4d339a7517c81C32a01221ba51CBd5d3461A94";
//init index
const indexFields = ["name", "description",
    "properties:artist:name", "properties:artist:bio",
    "properties:drop:name", "properties:drop:description"];

const index = new Document({
    document: {
        id: "properties:selling_info:itemId",
        index: indexFields
    }
})


// Make a singleton;
async function initStructure(server) {
    const sequelize = server.plugins["hapi-sequelizejs"].thetaboard;
    const sellingItems = await marketplaceContract.fetchSellingItems();

    marketplaceContract.on("MarketItemCreated", async (itemId, nftContract, tokenId, seller, buyer, category, price, isSold, event) => {
        // if it is a new item we add it;
        if(!isSold){
            const tnt721 = await explorer.get_nft_info_721(nftContract, tokenId.toString(), itemId, sequelize);
            index.allNFTSIndex[itemId] = index.allNFTs.push(tnt721) - 1;
            index.totalCount++;
            index.addAsync(tnt721);
        } else {
            // otherwise we remove it
            index.allNFTs.splice(index.allNFTSIndex[itemId] ,1);
            delete index.allNFTSIndex[itemId];
            index.totalCount--;
            index.removeAsync(itemId);
        }
    });

    // get all NFTs infos and load them in memory
    index.totalCount = 0;
    index.allNFTSIndex = {};
    index.allNFTs = [];
    await Promise.all(sellingItems.map(async (x) => {
        const tnt721 = await explorer.get_nft_info_721(x.nftContract, x.tokenId.toString(), x.itemId, sequelize);
        index.allNFTSIndex[x.itemId] = index.allNFTs.push(tnt721) - 1;
        index.totalCount++;
        index.addAsync(tnt721);
    }));
    return index;
}

module.exports = {
    initStructure: initStructure,
}