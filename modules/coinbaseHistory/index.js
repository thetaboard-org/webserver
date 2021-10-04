const Boom = require('@hapi/boom');
const {Op, literal} = require("sequelize");
const got = require('got');
const wei_divider = 1000000000000000000;

// a middleware function with no mount path. This code is executed for every request to the router
const api_token = "API_TOKEN" in process.env && process.env.API_TOKEN ? process.env.API_TOKEN : null;
const theta_explorer_api_params = {
    https: {rejectUnauthorized: false},
}
if (api_token) {
    theta_explorer_api_params.headers = {"x-api-token": api_token}
}
const coinbaseHistory = function (server, options, next) {
    server.route({
        path: '/',
        method: 'GET',
        handler: async (req, h) => {
            try {
                // get price
                const prices = await got(`${req.theta_explorer_api_domain}/api/price/all`, theta_explorer_api_params);
                const tfuel_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'TFUEL')[0]['price'];

                const walletAddresses = typeof req.query["wallets[]"] == 'string' ? [req.query["wallets[]"]] : req.query["wallets[]"];

                const ts = Math.round(new Date().getTime() / 1000);
                const tsYesterday = ts - (24 * 3600);
                const tsLastWeek = ts - (7 * 24 * 3600);
                const tsLastMonth = ts - (31 * 24 * 3600);
                const tsLastSixMonths = ts - (6 * 31 * 24 * 3600);
                const GN_REWARDS = [12, 11.88, 11.76, 11.64, 11.52];
                const GN_CONDITION = GN_REWARDS.map((x) => `tfuel % ${x * wei_divider} = 0`).join(' OR ');
                const GN_CONDITION_DIFF = GN_REWARDS.map((x) => `tfuel % ${x * wei_divider} != 0`).join(' AND ');
                const query = {
                    attributes: [
                        'to_address',
                        [literal(`SUM(if(tx_timestamp > ${tsYesterday} AND (${GN_CONDITION}) , tfuel, 0))`), 'last_day_gn'],
                        [literal(`SUM(if(tx_timestamp > ${tsLastWeek} AND (${GN_CONDITION}), tfuel, 0))`), 'last_week_gn'],
                        [literal(`SUM(if(tx_timestamp > ${tsLastMonth} AND (${GN_CONDITION}), tfuel, 0))`), 'last_month_gn'],
                        [literal(`SUM(if(tx_timestamp > ${tsLastSixMonths} AND (${GN_CONDITION}), tfuel, 0))`), 'last_six_months_gn'],

                        [literal(`COUNT(if(tx_timestamp > ${tsYesterday} AND (${GN_CONDITION}) , 1, null))`), 'last_day_count_gn'],
                        [literal(`COUNT(if(tx_timestamp > ${tsLastWeek} AND (${GN_CONDITION}), 1, null))`), 'last_week_count_gn'],
                        [literal(`COUNT(if(tx_timestamp > ${tsLastMonth} AND (${GN_CONDITION}), 1, null))`), 'last_month_count_gn'],
                        [literal(`COUNT(if(tx_timestamp > ${tsLastSixMonths} AND (${GN_CONDITION}), 1, null))`), 'last_six_months_count_gn'],

                        [literal(`SUM(if(tx_timestamp > ${tsYesterday} AND (${GN_CONDITION_DIFF}), tfuel, 0))`), 'last_day_en'],
                        [literal(`SUM(if(tx_timestamp > ${tsLastWeek} AND (${GN_CONDITION_DIFF}), tfuel, 0))`), 'last_week_en'],
                        [literal(`SUM(if(tx_timestamp > ${tsLastMonth} AND (${GN_CONDITION_DIFF}), tfuel, 0))`), 'last_month_en'],
                        [literal(`SUM(if(tx_timestamp > ${tsLastSixMonths} AND (${GN_CONDITION_DIFF}), tfuel, 0))`), 'last_six_months_en'],

                        [literal(`COUNT(if(tx_timestamp > ${tsYesterday} AND (${GN_CONDITION_DIFF}) , 1, null))`), 'last_day_count_en'],
                        [literal(`COUNT(if(tx_timestamp > ${tsLastWeek} AND (${GN_CONDITION_DIFF}), 1, null))`), 'last_week_count_en'],
                        [literal(`COUNT(if(tx_timestamp > ${tsLastMonth} AND (${GN_CONDITION_DIFF}), 1, null))`), 'last_month_count_en'],
                        [literal(`COUNT(if(tx_timestamp > ${tsLastSixMonths} AND (${GN_CONDITION_DIFF}), 1, null))`), 'last_six_months_count_en'],
                    ],
                    group: "to_address",
                    where: {
                        [Op.and]: [
                            {
                                to_address: {
                                    [Op.or]: walletAddresses
                                }
                            },
                            {
                                type: 0
                            },
                            {
                                tx_timestamp: {
                                    [Op.gt]: tsLastSixMonths
                                }
                            }
                        ]
                    }
                }

                const coinbase_list = await req.getModel('TransactionHistory').findAll(query);

                const coinbase_history = coinbase_list.reduce((acc, x) => {
                    ['en', 'gn'].forEach((type) => {
                        acc.push(...[
                            {
                                "id": x["to_address"] + 'last_day' + type,
                                "type": 'coinbase-history',
                                "attributes": {
                                    "type": type,
                                    "time-scale": "last_day",
                                    "count": x.dataValues["last_day_count_" + type],
                                    "tfuel": x.dataValues["last_day_" + type],
                                    "to-address": x["to_address"],
                                    "value": x.dataValues["last_day_" + type] / wei_divider,
                                    "tfuel-price": x.dataValues["last_day_" + type] / wei_divider * tfuel_price
                                }
                            },
                            {
                                "id": x["to_address"] + 'last_week' + type,
                                "type": 'coinbase-history',
                                "attributes": {
                                    "type": type,
                                    "time-scale": "last_week",
                                    "count": x.dataValues["last_week_count_" + type],
                                    "tfuel": x.dataValues["last_week_" + type],
                                    "to-address": x["to_address"],
                                    "value": x.dataValues["last_week_" + type] / wei_divider,
                                    "tfuel-price": x.dataValues["last_week_" + type] / wei_divider * tfuel_price
                                }
                            },
                            {
                                "id": x["to_address"] + 'last_month' + type,
                                "type": 'coinbase-history',
                                "attributes": {
                                    "type": type,
                                    "time-scale": "last_month",
                                    "count": x.dataValues["last_month_count_" + type],
                                    "tfuel": x.dataValues["last_month_" + type],
                                    "to-address": x["to_address"],
                                    "value": x.dataValues["last_month_" + type] / wei_divider,
                                    "tfuel-price": x.dataValues["last_month_" + type] / wei_divider * tfuel_price
                                }
                            },
                            {
                                "id": x["to_address"] + 'last_six_months' + type,
                                "type": 'coinbase-history',
                                "attributes": {
                                    "type": type,
                                    "time-scale": "last_six_months",
                                    "count": x.dataValues["last_six_months_count_" + type],
                                    "tfuel": x.dataValues["last_six_months_" + type],
                                    "to-address": x["to_address"],
                                    "value": x.dataValues["last_six_months_" + type] / wei_divider,
                                    "tfuel-price": x.dataValues["last_six_months_" + type] / wei_divider * tfuel_price
                                }
                            }
                        ])
                    })

                    return acc;
                }, []);

                return h.response({data: coinbase_history});
            } catch (e) {
                if (e && e.errors) {
                    e = e.errors[0].message;
                }
                return Boom.badRequest(e);
            }
        }
    });
};

module.exports = {
    register: coinbaseHistory,
    name: 'coinbaseHistory',
    version: '1.0.0'
};