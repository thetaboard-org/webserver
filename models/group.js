module.exports = function (sequelize, DataTypes) {
    const Group = sequelize.define('Group', {
            uuid: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
            },
            //link user record
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: true
            },
            isDefault: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false
            }
        });

    Group.associate = function (models) {
        Group.belongsTo(models.User, {
            foreignKey: {
                name: 'userId'
            }
        });
        Group.belongsToMany(models.Wallet, { 
            through: 'WalletGroups',
            foreignKey: 'walletId'
        });
    }

    Group.prototype.toJSON = function () {
        const values = Object.assign({}, this.get());
        return values;
    }
    Group.sync({alter: true});
    return Group;
};

