module.exports = function (sequelize, DataTypes) {
    const Tfuelstake = sequelize.define('Tfuelstake', {
            // link user record
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
            edgeNodeId: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            summary: {
                type: DataTypes.TEXT,
                allowNull: true
            },
        },
        {
            indexes: [{
                fields: ['walletAddress'],
                unique: false,
            }]
        });

    Tfuelstake.associate = function (models) { //create associations/foreign key constraint
        Tfuelstake.belongsTo(models.User, {
            foreignKey: {
                name: 'userId'
            }
        });
    }

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
    Tfuelstake.sync({alter: true});
    Tfuelstake.afterFind(async (models, something, somethingElse) => {
        models.map(update_stake_amount);
        return models;
    });

    return Tfuelstake;
};

// todo this method should be in the model directly, but to do that we would need to merge publicEdgeNode.js and tfuelstake.js

const got = require('got');
const theta_explorer_api_domain = "https://explorer.thetatoken.org:8443";
const api_token = "API_TOKEN" in process.env && process.env.API_TOKEN ? process.env.API_TOKEN : null;
const wei_divider = 1000000000000000000;
const theta_explorer_api_params = {
    https: {rejectUnauthorized: false},
}
if (api_token) {
    theta_explorer_api_params.headers = {"x-api-token": api_token}
}

const update_stake_amount = async (model) => {
    if (model.updatedAt < new Date(Date.now() - (10 * 60 * 1000))) {
        try {
            if (!model.summary) {
                model.stakeAmount = 0;
                model.save();
                console.warn("" +
                    "No summary for EN: ", model.id);
            } else {
                const edgeNodeAddress = model.summary.substring(0, 42);
                const rawStakes = await got(`${theta_explorer_api_domain}/api/stake/${edgeNodeAddress}?types[]=eenp`, theta_explorer_api_params);
                const stakes = await JSON.parse(rawStakes.body).body.holderRecords;
                if (stakes && stakes.length > 0) {
                    const finalAmount = Math.round(stakes.filter((x) => !x.withdrawn).reduce((a, b) => Number(a) + Number(b.amount), 0));
                    model.stakeAmount = Math.min((finalAmount / wei_divider), 500000);
                    model.save();
                } else {
                    model.stakeAmount = 0;
                    model.save();
                }
            }
        } catch (e) {
            console.warn("error fetching staking for EN :", model.id, e)
        }

    }
    return model;
}
module.exports.update_stake_amount = update_stake_amount;
