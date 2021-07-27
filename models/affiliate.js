module.exports = function (sequelize, DataTypes) {
    const Affiliate = sequelize.define('Affiliate', 
        {
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
                allowNull: false
            },
            displayName: {
                type: DataTypes.STRING,
                allowNull: false
            },
            logo: {
                type: DataTypes.STRING,
                allowNull: true
            },
        },
        {
            indexes: [{
                fields: ['name'],
                unique: true,
            },
            {
                fields: ['userId'],
                unique: false
            }]
        }
    );

    Affiliate.associate = function(models) { //create associations/foreign key constraint
        Affiliate.belongsTo(models.User, {
            foreignKey: {
                name: 'userId'
            }
        });
        Affiliate.hasMany(models.PublicEdgeNode, {foreignKeyConstraint: true});
    }

    Affiliate.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'affiliate',
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

    Affiliate.sync({alter: true});
    return Affiliate;
};

