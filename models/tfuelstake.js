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
                allowNull: true
            },
            status: {
                type: DataTypes.ENUM,
                values: ['staking', 'staked', 'unstaking', 'unstaked'],
                defaultValue: 'staking',
                allowNull: false
            },
            edgeNodeId: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            edgeNodeSummary: {
                type: DataTypes.TEXT,
                allowNull: true
            },
        },
        {
            associate: function (models) { //create associations/foreign key constraint
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
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'tfuelstake',
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
    Tfuelstake.sync({alter: true})
    return Tfuelstake;


};

