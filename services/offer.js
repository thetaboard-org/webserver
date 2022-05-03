const {ethers} = require("ethers");

// init contract
const offer_abi = require("../abi/offer_abi.json");
const offer_addr = "0x7831bA239b42acb4e9339991bE8b4B67bF18892B";
const provider = new ethers.providers.JsonRpcProvider("http://142.44.213.241:18888/rpc");
const offerContract = new ethers.Contract(offer_addr, offer_abi, provider);


class Offer {
    server;

    constructor(server) {
        this.server = server;
        this.initStructure();
    }

    async initStructure() {
        const nftCollection = this.server.hmongoose.connection.models.nft;
        const offers = await offerContract.fetchOffers();

        offerContract.on("OfferCreated", this._indexOffer);
        offerContract.on("OfferAccepted", this._removeOffer);
        offerContract.on("OfferDenied", this._removeOffer);
        offerContract.on("OfferCanceled", this._removeOffer);

        const item_ids = offers.map((x) => Number(x.itemId));

        const result = await nftCollection.updateMany({
                "tnt721.properties.offers.itemId": {
                    "$nin": item_ids, $exists: true,
                    $ne: null
                }
            },
            {"$set": {"tnt721.properties.offers": null}}
        );
        console.log("Deleted " + result.modifiedCount + " offers");


        const to_index = await nftCollection.aggregate([
            {
                $match: {
                    "tnt721.properties.offers.itemId": {
                        $in: item_ids
                    }
                }
            },
            {$unwind: "$tnt721.properties.offers"},
            {
                $group: {
                    _id: null,
                    found: {
                        "$push": "$tnt721.properties.offers.itemId"
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
        ]);

        await Promise.all(offers.map(async (x) => {
            if (to_index.length === 0 || to_index["0"].notfound.includes(x.itemId.toNumber())) {
                const nft = await nftCollection.getOrCreate(x.nftContract.toLowerCase(), x.tokenId.toString());
                // if nft is not valid, do not show
                if (!nft) {
                    return;
                }
                return this._addOffers(nft, x.itemId.toString(), x.offerer, x.price.toString());
            }
        }));

        console.log(`Done initializing offers`);
    }

    async _addOffers(nft, itemId, offerer, price) {
        nft.tnt721.properties.offers = nft.tnt721.properties.offers.filter(x => x.itemId === itemId);
        nft.tnt721.properties.offers.push({itemId: itemId, offerer: offerer, price: price});
        return await nft.save();
    }

    async _indexOffer(itemId, nftContract, tokenId, offerer, offered, price, event) {
        const nftCollection = this.server.hmongoose.connection.models.nft;
        const nft = await nftCollection.getOrCreate(nftContract.toLowerCase(), tokenId.toString());
        return await this._addOffers(nft, itemId.toString(), offerer, price.toString());
    }

    async _removeOffer(itemId, nftContract, tokenId, offerer, offered, price, event) {
        const nftCollection = this.server.hmongoose.connection.models.nft;
        const nft = await nftCollection.getOrCreate(nftContract.toLowerCase(), tokenId.toString());
        nft.tnt721.properties.offers = nft.tnt721.properties.offers.filter(x => x.itemId === itemId);
        return await nft.save();
    }

}

module.exports = Offer;