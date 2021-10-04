module.exports = function (sequelize, DataTypes) {
    const nftTokenIds = sequelize.define('NftTokenIds', {
            //link NFT record
            nftId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            arrayOfIds: {
                type: DataTypes.TEXT,
                allowNull: false,
            }
        },
        {
            indexes: [{
                fields: ['nftId'],
                unique: false
            }]
        });

    nftTokenIds.associate = function (models) {
        nftTokenIds.belongsTo(models.NFT, {
            foreignKey: {
                name: 'nftId'
            }
        });
    }

    return nftTokenIds;
}