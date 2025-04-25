const {ethers} = require("ethers");

// init contract
const marketplace_abi = require("../abi/marketplace_abi.json");
const marketplace_addr = "0x533c8425897b3E10789C1d6F576b96Cb55E6F47d";
const provider = new ethers.providers.JsonRpcProvider("http://142.44.213.241:18888/rpc");
const marketplaceContract = new ethers.Contract(marketplace_addr, marketplace_abi, provider);

const facets = ['artist', 'priceRange', 'category', 'drop'];
const priceRanges = [[0, 49], [50, 249], [250, 999], [1000, 9999], [10000, "Infinity"]];
const categories = [{id: 0, name: 'TNS'}, {id: 1, name: 'Art'}];


class Marketplace {
    server;

    constructor(server) {
        this.server = server;
        this.initStructure();
    }

    async initStructure() {
        try {
            const server = this.server;
            const nftCollection = server.hmongoose.connection.models.nft;

            let sellingItems;
            try {
                sellingItems = await marketplaceContract.fetchSellingItems();
            } catch (err) {
                console.error("Error fetching selling items from contract:", err);
                return;
            }

            try {
                marketplaceContract.on("MarketItemCreated", this._eventHandler.bind(this));
                marketplaceContract.on("MarketItemSale", this._eventHandler.bind(this));
            } catch (err) {
                console.error("Error setting up contract event listeners:", err);
                return;
            }

            const item_ids = sellingItems.map((x) => Number(x.itemId));

            try {
                const result = await nftCollection.updateMany({
                    "tnt721.properties.selling_info.itemId": {
                        "$nin": item_ids, $exists: true, $ne: null
                    }
                }, {"$set": {"tnt721.properties.selling_info": null}});
                console.log("Deleted " + result.modifiedCount + " item(s) from marketplace");
            } catch (err) {
                console.error("Error updating NFT collection to remove outdated items:", err);
            }

            let to_index;
            try {
                to_index = await nftCollection.aggregate([{
                    $match: {
                        "tnt721.properties.selling_info.itemId": {
                            $in: item_ids
                        }
                    }
                }, {
                    $group: {
                        _id: null, found: {
                            "$addToSet": "$tnt721.properties.selling_info.itemId"
                        }
                    }
                }, {
                    "$addFields": {
                        fullList: item_ids
                    }
                }, {
                    "$addFields": {
                        notfound: {
                            "$setDifference": ["$fullList", "$found"]
                        }
                    }
                }]);
            } catch (err) {
                console.error("Error aggregating NFT collection for indexing:", err);
                return;
            }

            try {
                await Promise.all(sellingItems.map(async (x) => {
                    try {
                        if (!x.isSold && (to_index.length === 0 || to_index["0"].notfound.includes(x.itemId.toNumber()))) {
                            const nft = await nftCollection.getOrCreate(x.nftContract.toLowerCase(), x.tokenId.toString());
                            if (!nft) {
                                return;
                            }
                            return this._indexTNT721(nft, x.itemId.toString(), x.seller, x.price.toString(), x.category);
                        }
                    } catch (err) {
                        console.error("Error processing selling item with ID:", x.itemId.toString(), err);
                    }
                }));
            } catch (err) {
                console.error("Error processing selling items:", err);
            }

            console.log(`Done initializing marketplace`);
        } catch (err) {
            console.error("Error initializing marketplace structure:", err);
        }
    }

    async _eventHandler(itemId, nftContract, tokenId, seller, buyer, category, price, isSold, event) {
        try {
            const nftCollection = this.server.hmongoose.connection.models.nft;

            const nft = await nftCollection.getOrCreate(nftContract.toLowerCase(), tokenId.toString());
            if (!isSold) {
                console.log("Adding new item to marketplace : ", Number(itemId.toString()));
                await this._indexTNT721(nft, itemId, seller, price.toString(), category);
            } else {
                console.log("Removing item from marketplace : ", Number(itemId.toString()));
                const id = `${nftContract.toLowerCase()}:${tokenId}`;

                nftCollection.updateOne({_id: id},
                    {"$set": {"tnt721.properties.selling_info": null}});
            }
        } catch (err) {
            console.error("Error handling marketplace event:", err);
        }
    }

    async _indexTNT721(nft, itemId, seller, price, category) {
        try {
            nft.tnt721.properties.selling_info = {
                "itemId": itemId,
                "seller": seller,
                "category": category,
                "price": price
            }
            return await nft.save();
        } catch (err) {
            console.error("Error indexing TNT721:", err);
        }
    }

    get facets() {
        return {types: facets, priceRanges: priceRanges, categories: categories}
    }

    async getNFTSellInfo(contract, tokenId) {
        try {
            const sellInfo = await marketplaceContract.getByNftContractTokenId(contract, tokenId);
            if (sellInfo.itemId.toNumber() !== 0 && !sellInfo.isSold) {
                return {
                    "itemId": sellInfo.itemId.toNumber(),
                    "seller": sellInfo.seller.toLowerCase(),
                    "category": sellInfo.category,
                    "price": sellInfo.price.toString()
                }
            } else {
                return null;
            }
        } catch (err) {
            console.error("Error fetching NFT sell info:", err);
            return null;
        }
    }

}


module.exports = Marketplace;

