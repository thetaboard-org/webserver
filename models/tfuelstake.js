module.exports = function (sequelize, DataTypes) {
    const Tfuelstake = sequelize.define('Tfuelstake', {
            //link user record
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            walletAddress: {
                type: DataTypes.STRING,
                allowNull: false
            },
            stakeAmount: {
                type: DataTypes.FLOAT,
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM,
                values: ['staking', 'staked', 'unstaking', 'unstaked'],
                defaultValue: 'staking',
                allowNull: false
            },
            edgeNodeId: {
                type: DataTypes.STRING,
                allowNull: true
            },
        },
        {
            associate: function(models) { //create associations/foreign key constraint
                Tfuelstake.belongsTo(models.Users, {
                    foreignKey: {
                      name: 'userId'
                    }
                  });
            }
        },
        {
            indexes: [{
                fields: ['walletAddress'],
                unique: false,
            },
            {
                fields: ['userId'],
                unique: false,
            }]
        });

    Tfuelstake.prototype.toJSON = function () {
        const values = Object.assign({}, this.get());
        return values;
    }
    return Tfuelstake;


};

