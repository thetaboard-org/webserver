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
                allowNull: true
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            image: {
                type: DataTypes.STRING,
                allowNull: true
            },
            nftContractId: {
                type: DataTypes.STRING,
                allowNull: true
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
                allowNull: true
            },
            price: {
                type: DataTypes.INTEGER,
                allowNull: true
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
                }],
            paranoid: true
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
        NFT.hasMany(models.NFTAsset, {foreignKey: 'nftId', foreignKeyConstraint: true, as: "NFTAsset"});
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
        const blacklist = ['NFTAsset'];
        return {
            id: values.id,
            type: 'nft',
            attributes: Object.entries(values).reduce((acc, value) => {
                const [key, val] = value;
                if (key === 'id') {
                    return acc
                }
                if (!blacklist.includes(key)) {
                    acc[toKebabCase(key)] = val;
                }
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
                "offers": null
            },
            "attributes": null,
            "token_id": null
        }
        if (NFT.Artist) {
            const attributes = NFT.Artist.toJSON().attributes;
            attributes["id"] = NFT.Artist.id;
            TNT721.properties.artist = attributes;
        }
        if (NFT.Drop) {
            const attributes = NFT.Drop.toJSON().attributes;
            attributes["id"] = NFT.Drop.id;
            TNT721.properties.drop = attributes;
        }
        if (NFT.NFTAsset) {
            TNT721.properties.assets = NFT.NFTAsset.map((x) => x.toJSON().attributes);
        }
        if (TOKEN_ID && NFT.NftTokenId) {
            const array = JSON.parse(NFT.NftTokenId.arrayOfIds);
            try {
                TNT721.token_id = array[TOKEN_ID];

            } catch (e) {
                TNT721.token_id = Number(TOKEN_ID) + 1;
            }
        } else if (TOKEN_ID) {
            TNT721.token_id = Number(TOKEN_ID) + 1;
        }
        return TNT721
    }
    return NFT;
};

