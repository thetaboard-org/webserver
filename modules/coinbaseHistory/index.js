const Boom = require('@hapi/boom');
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

                        const walletAddresses = typeof req.query["wallets[]"] == 'string' ? [req.query["wallets[]"].toLowerCase()] : req.query["wallets[]"].map((x) => x.toLowerCase());
                        const tsYesterday = new Date(new Date().setDate(new Date().getDate() - 1));
                        const tsLastWeek = new Date(new Date().setDate(new Date().getDate() - 7));
                        const tsLastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1));
                        const tsLastSixMonths = new Date(new Date().setMonth(new Date().getMonth() - 6));
                        const GN_REWARDS = [12.00 * wei_divider, 11.88 * wei_divider, 11.76 * wei_divider, 11.64 * wei_divider, 11.52 * wei_divider];
                        const GN_CONDITION = {
                            "$or": GN_REWARDS.map((x) => {
                                return {"$eq": [{"$mod": ["$tfuel", x]}, 0]}
                            })
                        }

                        const GN_CONDITION_DIFF = {
                            "$and": GN_REWARDS.map((x) => {
                                return {"$ne": [{"$mod": ["$tfuel", x]}, 0]}
                            })
                        }

                        const transactions_collection = req.mongo.db.collection('transaction')
                        const match = {
                            "$and": [
                                {
                                    "$or": walletAddresses.map((wallet) => {
                                        return {"to_address": wallet}
                                    })
                                },
                                {"type": 0},
                                {"timestamp": {"$gte": tsLastSixMonths}},
                                {"tfuel": {"$ne": null}},
                                {"tfuel": {"$ne": 0}},
                            ]
                        }
                        const project = {
                            _id: 0,
                            "last_day_gn": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$gte": ["$timestamp", tsYesterday]},
                                            GN_CONDITION
                                        ]
                                    }, "$tfuel", 0]
                            },
                            "last_week_gn": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$gte": ["$timestamp", tsLastWeek]},
                                            GN_CONDITION
                                        ]
                                    }, "$tfuel", 0]
                            },
                            "last_month_gn": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$gte": ["$timestamp", tsLastMonth]},
                                            GN_CONDITION
                                        ]
                                    }, "$tfuel", 0]
                            },
                            "last_six_months_gn": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$gte": ["$timestamp", tsLastSixMonths]},
                                            GN_CONDITION
                                        ]
                                    }, "$tfuel", 0]
                            },
                            "last_day_en": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$gte": ["$timestamp", tsYesterday]},
                                            GN_CONDITION_DIFF
                                        ]
                                    }, "$tfuel", 0]
                            },
                            "last_week_en": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$gte": ["$timestamp", tsLastWeek]},
                                            GN_CONDITION_DIFF
                                        ]
                                    }, "$tfuel", 0]
                            },
                            "last_month_en": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$gte": ["$timestamp", tsLastMonth]},
                                            GN_CONDITION_DIFF
                                        ]
                                    }, "$tfuel", 0]
                            },
                            "last_six_months_en": {
                                "$cond": [
                                    {
                                        "$and": [
                                            {"$gte": ["$timestamp", tsLastSixMonths]},
                                            GN_CONDITION_DIFF
                                        ]
                                    }, "$tfuel", 0]
                            },
                            "to_address": 1
                        }
                        const group = {
                            _id: "$to_address",
                            "last_day_gn_sum": {"$sum": '$last_day_gn'},
                            "last_day_gn_count": {"$sum": {"$cond": [{$gt: ["$last_day_gn", 0]}, 1, 0]}},
                            "last_week_gn_sum": {"$sum": '$last_week_gn'},
                            "last_week_gn_count": {"$sum": {"$cond": [{$gt: ["$last_week_gn", 0]}, 1, 0]}},
                            "last_month_gn_sum": {"$sum": '$last_month_gn'},
                            "last_month_gn_count": {"$sum": {"$cond": [{$gt: ["$last_month_gn", 0]}, 1, 0]}},
                            "last_six_months_gn_sum": {"$sum": '$last_six_months_gn'},
                            "last_six_months_gn_count": {"$sum": {"$cond": [{$gt: ["$last_six_months_gn", 0]}, 1, 0]}},

                            "last_day_en_sum": {"$sum": '$last_day_en'},
                            "last_day_en_count": {"$sum": {"$cond": [{$gt: ["$last_day_en", 0]}, 1, 0]}},
                            "last_week_en_sum": {"$sum": '$last_week_en'},
                            "last_week_en_count": {"$sum": {"$cond": [{$gt: ["$last_week_en", 0]}, 1, 0]}},
                            "last_month_en_sum": {"$sum": '$last_month_en'},
                            "last_month_en_count": {"$sum": {"$cond": [{$gt: ["$last_month_en", 0]}, 1, 0]}},
                            "last_six_months_en_sum": {"$sum": '$last_six_months_en'},
                            "last_six_months_en_count": {"$sum": {"$cond": [{$gt: ["$last_six_months_en", 0]}, 1, 0]}},
                        }
                        const pipeline = [
                            {"$match": match},
                            {"$project": project},
                            {"$group": group}
                        ]
                        const coinbase_list = await transactions_collection.aggregate(pipeline).toArray();

                        const coinbase_history = coinbase_list.reduce((acc, x) => {
                            ['en', 'gn'].forEach((type) => {
                                acc.push(...[
                                    {
                                        "id": x["_id"] + 'last_day' + type,
                                        "type": 'coinbase-history',
                                        "attributes": {
                                            "type": type,
                                            "time-scale": "last_day",
                                            "count": x[`last_day_${type}_count`],
                                            "tfuel": x[`last_day_${type}_sum`],
                                            "to-address": x["_id"],
                                            "value": x[`last_day_${type}_sum`] / wei_divider,
                                            "tfuel-price": x[`last_day_${type}_sum`] / wei_divider * tfuel_price
                                        }
                                    },
                                    {
                                        "id": x["_id"] + 'last_week' + type,
                                        "type": 'coinbase-history',
                                        "attributes": {
                                            "type": type,
                                            "time-scale": "last_week",
                                            "count": x[`last_week_${type}_count`],
                                            "tfuel": x[`last_week_${type}_sum`],
                                            "to-address": x["_id"],
                                            "value": x[`last_week_${type}_sum`] / wei_divider,
                                            "tfuel-price": x[`last_week_${type}_sum`] / wei_divider * tfuel_price
                                        }
                                    },
                                    {
                                        "id": x["_id"] + 'last_month' + type,
                                        "type": 'coinbase-history',
                                        "attributes": {
                                            "type": type,
                                            "time-scale": "last_month",
                                            "count": x[`last_month_${type}_count`],
                                            "tfuel": x[`last_month_${type}_sum`],
                                            "to-address": x["_id"],
                                            "value": x[`last_month_${type}_sum`] / wei_divider,
                                            "tfuel-price": x[`last_month_${type}_sum`] / wei_divider * tfuel_price
                                        }
                                    },
                                    {
                                        "id": x["_id"] + 'last_six_months' + type,
                                        "type": 'coinbase-history',
                                        "attributes": {
                                            "type": type,
                                            "time-scale": "last_six_months",
                                            "count": x[`last_six_months_${type}_count`],
                                            "tfuel": x[`last_six_months_${type}_sum`],
                                            "to-address": x["_id"],
                                            "value": x[`last_six_months_${type}_sum`] / wei_divider,
                                            "tfuel-price": x[`last_six_months_${type}_count`] / wei_divider * tfuel_price
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
            }
        )
        ;
    }
;

module.exports = {
    register: coinbaseHistory,
    name: 'coinbaseHistory',
    version: '1.0.0'
};