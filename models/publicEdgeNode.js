module.exports = function (sequelize, DataTypes) {
    const PublicEdgeNode = sequelize.define('PublicEdgeNode', 
        {
            summary: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            nodeId: {
                type: DataTypes.STRING,
                allowNull: false
            },
        },
        {
            indexes: [
                {
                    fields: ['nodeId'],
                    unique: true,
                },
            ]
        }
    );

    PublicEdgeNode.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'publicEdgeNode',
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
    PublicEdgeNode.sync({alter: true});
    return PublicEdgeNode;
};

