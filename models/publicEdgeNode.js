const update_stake_amount = require('./tfuelstake').update_stake_amount;

module.exports = function (sequelize, DataTypes) {
    const PublicEdgeNode = sequelize.define('PublicEdgeNode',
        {
            summary: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            nodeId: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            stakeAmount: {
                type: DataTypes.FLOAT,
                allowNull: true
            },
            splitRewards: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
            },
        },
        {
            indexes: [
                {
                    fields: ['nodeId'],
                    unique: true,
                },
                {
                    fields: ['affiliateId'],
                    unique: false
                }
            ]
        }
    );

    PublicEdgeNode.associate = function(models) { //create associations/foreign key constraint
        PublicEdgeNode.belongsTo(models.Affiliate, {
            foreignKey: {
                name: 'affiliateId'
            }
        });
    }

    PublicEdgeNode.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'publicEdgeNode',
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
    // PublicEdgeNode.sync({alter: true});

    PublicEdgeNode.afterFind(async (models) => {
        models.map(update_stake_amount);
        return models;
    });

    return PublicEdgeNode;
};

