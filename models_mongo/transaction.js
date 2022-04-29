const mongoose = require('mongoose');
const {Schema} = mongoose;


class transaction {
    server;
    _schema;

    constructor(server) {
        this.server = server;
        return this.schema;
    }

    get schema() {
        if (!this._schema) {
            this._schema = new Schema({
                "_id": String,
                "block_hash": String,
                "block_height": Number,
                "hash": String,
                "type": Number,
                "from_address": String,
                "to_address": String,
                "contract_address": String,
                "timestamp": Date,
                "status": Number,
                "theta": mongoose.Decimal128,
                "tfuel": mongoose.Decimal128,
                "fee_theta": mongoose.Decimal128,
                "fee_tfuel": mongoose.Decimal128,
                "gas_limit": mongoose.Decimal128,
                "gas_price": mongoose.Decimal128,
                "gas_used": Number,
                "duration": Number,
                "split_basis_point": String,
                "payment_sequence": String,
                "reserve_sequence": String,
                "resource_ids": String,
                "resource_id": String
            }, {collection: 'transaction'})
        }
        return this._schema;
    }
}

module.exports = transaction;