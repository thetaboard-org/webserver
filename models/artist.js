module.exports = function (sequelize, DataTypes) {
    const Artist = sequelize.define('Artist',
        {
            bio: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            logoName: {
                type: DataTypes.STRING,
                allowNull: true
            },
            image: {
                type: DataTypes.STRING,
                allowNull: true
            },
            instagram: {
                type: DataTypes.STRING,
                allowNull: true
            },
            youtube: {
                type: DataTypes.STRING,
                allowNull: true
            },
            twitter: {
                type: DataTypes.STRING,
                allowNull: true
            },
            website: {
                type: DataTypes.STRING,
                allowNull: true
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            walletAddr: {
                type: DataTypes.STRING,
                allowNull: true
            }
        },
        {
            paranoid: true
        }
    );

    Artist.associate = function (models) {
        Artist.belongsTo(models.User, {foreignKeyConstraint: true});
        Artist.hasMany(models.Drop, {foreignKey: 'artistId', foreignKeyConstraint: true});
        Artist.hasMany(models.NFT, {foreignKey: 'artistId', foreignKeyConstraint: true});
    }

    Artist.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'artist',
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
    // Artist.sync({alter: true});

    return Artist;
};

