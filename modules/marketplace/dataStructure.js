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
        index: indexFields
    }
})

marketplaceContract.on("MarketItemCreated", (itemId, nftContract, tokenId, seller, buyer, category, price, isSold, event) => {
    debugger
    console.log("labelHash: " + id.toHexString());
    console.log("tokenId: " + id.toString());
    console.log("owner: " + owner);
    console.log(event);
    debugger
});

// todo add document on add
// todo remove documents on sell/remove


async function initStructure(server) {
    const sequelize = server.plugins["hapi-sequelizejs"].thetaboard;
    const sellingItems = await marketplaceContract.fetchSellingItems();

    // dedup nfts
    // TODO do not dedup TNS
    const uniqueNFTsAddress = sellingItems.filter((arr, index, self) =>
        index === self.findIndex((t) => (t.save === arr.save && t.nftContract === arr.nftContract)));

    const allNFTs = [];
    const allNFTSIndex = {};
    uniqueNFTsAddress.map(async (x) => {
        const tnt721 = await explorer.get_nft_info_721(x.nftContract, x.tokenId.toString(), x.itemId, sequelize);
        allNFTSIndex[tnt721.properties.selling_info.itemId] = allNFTs.push(tnt721) - 1;
    });
    // add extra info to the index
    index.totalCount = uniqueNFTsAddress.length;
    index.allNFTs = allNFTs;
    index.allNFTSIndex = allNFTSIndex;

    return index;
}

module.exports = {
    initStructure: initStructure,
}