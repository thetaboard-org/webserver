module.exports = function (sequelize, DataTypes) {
    const Wallet = sequelize.define('Wallet', {
            //link user record
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            address: {
                type: DataTypes.STRING,
                allowNull: false
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
        },
        {
            indexes: [{
                fields: ['address'],
                unique: false,
            },
            {
                fields: ['userId'],
                unique: false
            }]
        });


    Wallet.associate = function (models) {
        Wallet.belongsTo(models.User, {
            foreignKey: {
                name: 'userId'
            }
        });
        Wallet.belongsToMany(models.Group, { 
         through: 'WalletGroups',
         foreignKey: 'groupId'
        });
    }
      

    Wallet.prototype.toJSON = function () {
        const values = Object.assign({}, this.get());
        return values;
    }
    Wallet.sync({alter: true});

    return Wallet;
};