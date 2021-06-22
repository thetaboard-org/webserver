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
            associate: function(models) { //create associations/foreign key constraint
                Wallet.belongsTo(models.Users, {
                    foreignKey: {
                      name: 'userId'
                    }
                  });
            }
        },
        {
            indexes: [{
                fields: ['address'],
                unique: false,
            },
            {
                fields: ['userId'],
                unique: false,
            }]
        });

    Wallet.prototype.toJSON = function () {
        const values = Object.assign({}, this.get());
        return values;
    }
    return Wallet;


};

