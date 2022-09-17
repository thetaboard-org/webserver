module.exports = function (sequelize, DataTypes) {
    const Airdrop = sequelize.define('Airdrop', {
            //link artist record
            artistId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            nftId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            sourceNFT: {
                type: DataTypes.STRING,
                allowNull: false
            },
            isDeployed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                default: false
            }
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
            foreignKey: 'nftId'
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
    Airdrop.sync({alter: true});

    return Airdrop;
};

