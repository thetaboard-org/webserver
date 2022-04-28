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

        marketplaceContract.on("MarketItemCreated", this._eventHandler);
        marketplaceContract.on("MarketItemSale", this._eventHandler);

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
            await this._indexTNT721(nft, itemId, seller, price, category);
        } else {
            console.log("Removing item from marketplace : ", Number(itemId.toString()));
            const id = `${nftContract}:${tokenId}`;
            nftCollection.updateOne({_id: id},
                {"$set": {"tnt721.properties.selling_info": null, "tnt721.tags": null}});
        }
    }

    async _indexTNT721(nft, itemId, seller, price, category) {
        // add tags and indexes
        const tags = [];

        const priceTfuel = ethers.utils.formatEther(price);
        if (priceTfuel <= priceRanges[0][1]) {
            tags.push(`priceRange:${priceRanges[0].join('|')}`);
        } else if (priceTfuel <= priceRanges[1][1]) {
            tags.push(`priceRange:${priceRanges[1].join('|')}`);
        } else if (priceTfuel <= priceRanges[2][1]) {
            tags.push(`priceRange:${priceRanges[2].join('|')}`);
        } else if (priceTfuel <= priceRanges[3][1]) {
            tags.push(`priceRange:${priceRanges[3].join('|')}`);
        } else {
            tags.push(`priceRange:${priceRanges[4].join('|')}`);
        }

        ['artist', 'drop'].forEach((facetName) => {
            if (nft.tnt721.properties[facetName]) {
                const id = nft.tnt721.properties[facetName].id
                tags.push(`${facetName}:${id}`);
            }
        });

        if (nft.contract === '0xbb4d339a7517c81c32a01221ba51cbd5d3461a94') {
            tags.push(`category:0`);
        } else {
            tags.push(`category:1`);
        }


        nft.tnt721.properties.selling_info = {
            "itemId": itemId,
            "seller": seller,
            "tags": tags,
            "category": category,
            "price": price
        }
        return await nft.save();
    }

    async updateNFTInfo(req, nft) {
        const nftCollection = req.mongo.db.collection('nft');
        const sellingItems = await nftCollection.find({contract: nft.nftContractId.toLowerCase()}).toArray();
        sellingItems.map(async (x) => {
            const tnt721 = await explorer.get_nft_info_721(x.contract, x.tokenId, x.tnt721.properties.selling_info.itemId, req);
            if (!tnt721) {
                return;
            }
            return this._indexTNT721(tnt721, nftCollection);
        })
        // if nft is not valid, do not show

    }

    get facets() {
        return {types: facets, priceRanges: priceRanges, categories: categories}
    }

}


module.exports = Marketplace;