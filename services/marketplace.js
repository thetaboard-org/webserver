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
        const server = this.server;
        const nftCollection = server.hmongoose.connection.models.nft;

        const sellingItems = await marketplaceContract.fetchSellingItems();

        marketplaceContract.on("MarketItemCreated", this._eventHandler.bind(this));
        marketplaceContract.on("MarketItemSale", this._eventHandler.bind(this));

        const item_ids = sellingItems.map((x) => Number(x.itemId));

        const result = await nftCollection.updateMany({
            "tnt721.properties.selling_info.itemId": {
                "$nin": item_ids, $exists: true, $ne: null
            }
        }, {"$set": {"tnt721.properties.selling_info": null}});
        console.log("Deleted " + result.modifiedCount + " item from marketplace");

        const to_index = await nftCollection.aggregate([{
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

        await Promise.all(sellingItems.map(async (x) => {
            if (!x.isSold && (to_index.length === 0 || to_index["0"].notfound.includes(x.itemId.toNumber()))) {
                const nft = await nftCollection.getOrCreate(x.nftContract.toLowerCase(), x.tokenId.toString());
                // if nft is not valid, do not show
                if (!nft) {
                    return;
                }
                return this._indexTNT721(nft, x.itemId.toString(), x.seller, x.price.toString(), x.category);
            }
        }));

        console.log(`Done initializing marketplace`);
    }

    async _eventHandler(itemId, nftContract, tokenId, seller, buyer, category, price, isSold, event) {
        const nftCollection = this.server.hmongoose.connection.models.nft;

        // if it is a new item we add it;
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
    }

    async _indexTNT721(nft, itemId, seller, price, category) {
        nft.tnt721.properties.selling_info = {
            "itemId": itemId,
            "seller": seller,
            "category": category,
            "price": price
        }
        return await nft.save();
    }

    get facets() {
        return {types: facets, priceRanges: priceRanges, categories: categories}
    }

    async getNFTSellInfo(contract, tokenId) {
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

    }

}


module.exports = Marketplace;