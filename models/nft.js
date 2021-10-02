module.exports = function (sequelize, DataTypes) {
    const NFT = sequelize.define('NFT', {
        //link artist record
        artistId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        //link drop record
        dropId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        smallDescription: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        image: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nftContractId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nftSellController: {
            type: DataTypes.STRING,
            allowNull: false
        },
        editionNumber: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        type: {
            type: DataTypes.ENUM,
            values: ['open', 'limited','auction'],
            defaultValue: 'open',
            allowNull: false
        },
        price: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
    },
    {
        indexes: [{
            fields: ['artistId'],
            unique: false
        },
        {
            fields: ['dropId'],
            unique: false
        }]
    });

    NFT.associate = function (models) {
        NFT.belongsTo(models.Artist, {
            foreignKey: {
                name: 'artistId'
            }
        });
        NFT.belongsTo(models.Drop, {
            foreignKey: {
                name: 'dropId'
            }
        });
        NFT.hasMany(models.NFTAsset, { foreignKey: 'nftId', foreignKeyConstraint: true });
    }

    NFT.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'nft',
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
    // NFT.sync({alter: true});

    return NFT;
};

