module.exports = function (sequelize, DataTypes) {
    const TnsTokenId = sequelize.define('TnsTokenId', {
        tokenId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: {
                msg: 'This tokenId is already in the list.'
            },
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    });

    TnsTokenId.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'tns-token-id',
            attributes: Object.entries(values).reduce((acc, value) => {
                const [key, val] = value;
                if (key === 'id') {
                    return acc;
                } else{
                    acc[toKebabCase(key)] = val;
                }
                return acc;
            }, {})
        }
    }


    // TnsTokenId.sync({alter: true});
    return TnsTokenId;
};

