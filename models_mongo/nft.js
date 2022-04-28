const mongoose = require('mongoose');
const {Schema} = mongoose;


class NFT {
    server;
    _schema;

    constructor(server) {
        this.server = server;
        this._schema = this.schema;
        this._index();
        this._statics();
        return this._schema;
    }

    get schema() {
        if (this._schema) {
            return this._schema;
        } else {
            return new Schema({
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
                        "artist": {}, // Defined in the artist model
                        "drop": {}, // Defined in the drop model
                        "assets": [], // Defined in the asset model
                        "selling_info": {
                            "itemId": {type: Number, index: true},
                            "seller": {type: String, lowercase: true, index: true},
                            "category": String,
                            "price": String,
                            "tags": {type: [String], index: true},
                        },
                        "offers": [{
                            "itemId": {type: Number, index: true},
                            "offerer": {type: String, lowercase: true},
                            "price": Number,
                        }]
                    },
                    "attributes": {}, // free schema coming from contract
                }
            }, {collection: 'nft'});
        }
    }

    _index() {
        this.schema.index({
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
    }

    _statics() {
        this.schema.statics.getOrCreate = async (contract, tokenId, useCache = true) => {
            const model = this.server.hmongoose.connection.models.nft;

            let nft = await model.findOne({contract: contract, tokenId: tokenId});
            if (nft.tnt721.name && useCache) {
                return nft;
            } else if (!nft) {
                nft = await this.create({contract: contract, tokenId: tokenId});
            }

            try {
                // special handling for TNS
                if (contract.toLowerCase() === '0xbb4d339a7517c81c32a01221ba51cbd5d3461a94') {
                    nft.tnt721 = await this.server.app.tnt721.get_tns_info(contract, tokenId);
                } else {
                    nft.tnt721 = await this.server.app.tnt721.get_info(contract, tokenId);
                }
                return await nft.save();
            } catch (e) {
                console.error("Could not get NFT");
                console.error(e);
                return null;
            }
        }
    }

}


module.exports = NFT;