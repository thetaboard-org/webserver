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
                allowNull: true, // null are allowed for NFT like badges, which are not sold as part of a drop
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
                allowNull: true
            },
            editionNumber: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            type: {
                type: DataTypes.ENUM,
                values: ['open', 'limited', 'auction'],
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
        NFT.hasMany(models.NFTAsset, {foreignKey: 'nftId', foreignKeyConstraint: true});
        NFT.hasOne(models.NftTokenIds, {foreignKey: 'nftId', foreignKeyConstraint: true});
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

    NFT.prototype.toERC721 = function (TOKEN_ID = null) {
        const NFT = this;
        const TNT721 = {
            "image": NFT.image,
            "name": NFT.name,
            "description": NFT.description,
            "properties": {
                "artist": null,
                "drop": null,
                "assets": null,
            },
            "attributes": null,
            "token_id": null
        }
        if (NFT.Artist) {
            TNT721.properties.artist = NFT.Artist.toJSON().attributes;
        }
        if (NFT.Drop) {
            TNT721.properties.drop = NFT.Drop.toJSON().attributes;
        }
        if (NFT.NFTAssets) {
            TNT721.properties.assets = NFT.NFTAssets.map((x) => x.toJSON().attributes);
        }
        if (TOKEN_ID && NFT.NftTokenId) {
            const array = JSON.parse(NFT.NftTokenId.arrayOfIds)
            TNT721.token_id = array[TOKEN_ID]
        }
        return TNT721
    }
    return NFT;
};

