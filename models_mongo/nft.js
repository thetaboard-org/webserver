const mongoose = require('mongoose');
const {Schema} = mongoose;

class NFT {
    server;
    _schema;

    constructor(server) {
        this.server = server;
        this._index();
        this._statics();
        this._virtual();
        return this._schema;
    }

    get schema() {
        if (!this._schema) {
            const Offers = new Schema(
                {
                    "itemId": {type: Number, index: true},
                    "offerer": {type: String, lowercase: true},
                    "price": {
                        type: mongoose.Decimal128,
                        get: (field) => {
                            return field.toString()
                        }
                    },
                },
                {toJSON: {getters: true}}
            )
            this._schema = new Schema({
                "_id": String,
                "contract": {type: String, lowercase: true, index: true},
                "owner": {type: String, lowercase: true},
                "tokenId": String,
                "blockNumber": Number,
                "tnt721": {
                    "contract_addr": {type: String, lowercase: true},
                    "original_token_id": String,
                    "token_id": String,
                    "image": String,
                    "name": String,
                    "description": String,
                    "properties": {
                        "artist": {
                            "bio": String,
                            "name": String,
                            "logo-name": String,
                            "image": String,
                            "instagram": String,
                            "youtube": String,
                            "twitter": String,
                            "website": String,
                            "wallet-addr": String,
                            "created-at": Date,
                            "updated-at": Date,
                            "deleted-at": Date,
                            "id": Number
                        }, // Defined in the artist model
                        "drop": {}, // Defined in the drop model
                        "assets": [], // Defined in the asset model
                        "selling_info": {
                            "itemId": {type: Number, index: true},
                            "seller": {type: String, lowercase: true, index: true},
                            "category": String,
                            "price": {
                                type: mongoose.Decimal128,
                                get: (field) => {
                                    return field.toString()
                                }
                            },
                        },
                        "offers": [Offers]
                    },
                    "attributes": {}, // free schema coming from contract
                }
            }, {collection: 'nft', toJSON: {virtuals: true, getters: true}});
        }
        return this._schema;
    }

    _index() {
        this.schema.index({
                "tnt721.name": "text",
                "tnt721.description": "text",
                "tnt721.properties.artist.name": "text",
                "tnt721.properties.artist.bio": "text",
                "tnt721.properties.drop.name": "text",
                "tnt721.properties.drop.description": "text"
            },
            {
                weights: {
                    "tnt721.name": 10,
                    "tnt721.description": 5,
                    "tnt721.properties.artist.name": 8,
                    "tnt721.properties.artist.bio": 3,
                    "tnt721.properties.drop.name": 8,
                    "tnt721.properties.drop.description": 3
                },
                name: "SearchIndexOnNameArtistDrop"
            });
    }

    _statics() {
        this.schema.statics.getOrCreate = async (contract, tokenId, useCache = false) => {
            const model = this.server.hmongoose.connection.models.nft;

            let nft = await model.findOne({contract: contract, tokenId: tokenId});
            if (nft.tnt721.name && useCache) {
                return nft;
            } else if (!nft) {
                nft = await this.create({contract: contract, tokenId: tokenId});
            }

            try {
                nft.tnt721 = await this.server.app.tnt721.get_info(contract, tokenId);
                return await nft.save();
            } catch (e) {
                console.error("Could not get NFT");
                console.error(e);
                return null;
            }
        }

        this.schema.statics.updateForContract = async (contract) => {
            const model = this.server.hmongoose.connection.models.nft;
            const NFTs = await model.find({contract: contract});
            for (const nft of NFTs) {
                // await is used to prevent crashing things with to many calls
                await model.getOrCreate(contract, nft.tokenId, false);
            }
        }
    }

    _virtual() {
        this.schema.virtual('tnt721.owner').get(function () {
            return this.owner;
        });
    }
}


module.exports = NFT;