const got = require('got');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const Moment = require('moment');

module.exports = function (sequelize, DataTypes) {
    const Price = sequelize.define('Price', {
            //link user record
            date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            theta_price: {
                type: DataTypes.FLOAT,
                allowNull: false
            },
            tfuel_price: {
                type: DataTypes.FLOAT,
                allowNull: false
            },
            currency: {
                type: DataTypes.STRING,
                allowNull: false
            },
        },
        {
            indexes: [
                {
                    fields: ['date'],
                    unique: false,
                },
                {
                    fields: ['date', 'currency'],
                    unique: true
                }
            ]
        }
    );

    Price.prototype.toJSON = function () {
        const toKebabCase = (str) => {
            return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
        };
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            type: 'price',
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

    Price.afterFind(async (models, query) => {
        function getDateRangeSize(startDate, stopDate) {
            let how_many_dates = 1;
            let currentDate = new Date(startDate);
            while (currentDate < new Date(stopDate)) {
                currentDate.setDate(currentDate.getDate() + 1);
                how_many_dates++;
            }
            return how_many_dates;
        }

        if (query.where.date) {
            const currency = query.where.currency ? query.where.currency : "USD";
            const start_date = query.where.date[Op.between][0];
            const end_date = Moment(query.where.date[Op.between][1]).format('YYYY-MM-DD');
            const dateRangeSize = getDateRangeSize(start_date, end_date);
            if (!models || models.length < dateRangeSize) {
                //theta-fuel, theta-token
                let start_ts = Math.round(new Date(start_date).getTime() / 1000);
                const end_ts = Math.round(new Date(end_date).getTime() / 1000)
                if (dateRangeSize < 183) {
                    // if less than 6 month, we increase date rang to at least 6 month. otherwise coingecko data granularity is different
                    start_ts = end_ts - 15811200;
                }

                const theta_price = await got(
                    `https://api.coingecko.com/api/v3/coins/theta-token/market_chart/range?vs_currency=${currency}&from=${start_ts}&to=${end_ts}`
                ).json();
                const tfuel_price = await got(
                    `https://api.coingecko.com/api/v3/coins/theta-fuel/market_chart/range?vs_currency=${currency}&from=${start_ts}&to=${end_ts}`
                ).json();
                const all_models = await Promise.all(theta_price.prices.map(async (x, idx) => {
                    return await Price.upsert({
                        date: Moment(x[0]).utc().format('YYYY-MM-DD'),
                        theta_price: x[1],
                        tfuel_price: tfuel_price.prices[idx][1],
                        currency: currency,
                    });
                }));
                // can't recreate "models" otherwise sequelize doesn't work.
                models.splice(0, models.length)
                models.push(...all_models.map((x) => x[0]).filter((x) => Moment(x.date) >= Moment(start_date)));
            }
        }
        return models;
    });

    return Price;
};

