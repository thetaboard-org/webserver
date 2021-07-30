module.exports = function (sequelize, DataTypes) {
    const TransactionHistory = sequelize.define('TransactionHistory',
        {
            block_hash: {
                type: DataTypes.TEXT,
            },
            block_height: {
                type: DataTypes.INTEGER,
            },           
            hash: {
                type: DataTypes.TEXT,
                primaryKey: true
            },
            type: {
                type: DataTypes.INTEGER
            },
            from_address: {
                type: DataTypes.TEXT,
            },
            to_address: {
                type: DataTypes.TEXT,
            },
            contract_address: {
                type: DataTypes.TEXT,
            },
            tx_timestamp: {
                type: DataTypes.INTEGER
            },
            status: {
                type: DataTypes.INTEGER
            },
            theta: {
                type: DataTypes.FLOAT,
            },
            tfuel: {
                type: DataTypes.FLOAT,
            },
            fee_theta: {
                type: DataTypes.FLOAT,
            },
            fee_tfuel: {
                type: DataTypes.FLOAT,
            },
            gas_limit: {
                type: DataTypes.INTEGER,
            },
            gas_price: {
                type: DataTypes.FLOAT,
            },
            gas_used: {
                type: DataTypes.INTEGER,
            },
            duration: {
                type: DataTypes.INTEGER
            },
            split_basis_point: {
                type: DataTypes.INTEGER
            },
            payment_sequence: {
                type: DataTypes.FLOAT,
            },
            reserve_sequence: {
                type: DataTypes.INTEGER
            },
            resource_ids: {
                type: DataTypes.TEXT,
            },
            resource_id: {
                type: DataTypes.TEXT,
            }
        },
        { timestamps: false }
    );

    TransactionHistory.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'TransactionHistory',
            attributes: Object.entries(values).reduce((acc, value) => {
                const [key, val] = value;
                if (key === 'id') {
                    return acc
                }
                acc[toKebabCase(key)] = val;
                return acc;
            }, {})
        }
    }

    return TransactionHistory;
};

