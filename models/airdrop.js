module.exports = function (sequelize, DataTypes) {
    const Airdrop = sequelize.define('Airdrop', {

            count: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            isDeployed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                default: false
            },
            winners: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            //link artist record
            artistId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            sourceNftId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            giftNftId: {
                type: DataTypes.INTEGER,
                allowNull: false
            },

        },
        {
            indexes: [{
                fields: ['artistId'],
                unique: false
            }],
            paranoid: true
        });

    Airdrop.associate = function (models) {
        Airdrop.belongsTo(models.Artist, {
            foreignKey: {
                name: 'artistId'
            }
        });
        Airdrop.belongsTo(models.NFT, {
            foreignKey: 'sourceNftId'
        });
        Airdrop.belongsTo(models.NFT, {
            foreignKey: 'giftNftId'
        });
    }

    Airdrop.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'airdrop',
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
    // Airdrop.sync({alter: true});

    return Airdrop;
};

