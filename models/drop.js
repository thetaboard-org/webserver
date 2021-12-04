module.exports = function (sequelize, DataTypes) {
    const Drop = sequelize.define('Drop', {
            //link artist record
            artistId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            startDate: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            endDate: {
                type: DataTypes.DATE,
                allowNull: false,
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
                allowNull: true
            },
            isPublic: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                default: false
            },
            isDeployed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                default: false
            }
        },
        {
            indexes: [{
                fields: ['artistId'],
                unique: false
            }],
            paranoid: true
        });

    Drop.associate = function (models) {
        Drop.belongsTo(models.Artist, {
            foreignKey: {
                name: 'artistId'
            }
        });
        Drop.hasMany(models.NFT, {foreignKey: 'dropId', foreignKeyConstraint: true});
    }

    Drop.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'drop',
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
    Drop.sync({alter: true});

    return Drop;
};

