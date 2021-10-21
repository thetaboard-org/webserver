module.exports = function (sequelize, DataTypes) {
    const NFTAsset = sequelize.define('NFTAsset', {
        //link NFT record
        nftId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM,
            values: ['image', 'video','object3D'],
            defaultValue: 'image',
            allowNull: false
        },
        asset: {
            type: DataTypes.STRING,
            allowNull: false
        },
    },
    {
        indexes: [{
            fields: ['nftId'],
            unique: false
        }],
        paranoid: true
    });

    NFTAsset.associate = function (models) {
        NFTAsset.belongsTo(models.NFT, {
            foreignKey: {
                name: 'nftId'
            }
        });
    }

    NFTAsset.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'nftAsset',
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
    NFTAsset.sync({alter: true});

    return NFTAsset;
};

