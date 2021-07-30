const Boom = require('@hapi/boom');
const { Op } = require("sequelize");
const dateFormat = require("dateformat");
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
                const theta_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'THETA')[0]['price'];

                // get coinbase history
                const coinbase_history = [];
                const walletAddresses = typeof req.query["wallets[]"] == 'string' ? [req.query["wallets[]"]] : req.query["wallets[]"];
                
                let whereCondition = {
                    where: {
                        [Op.and]: [
                            {
                                to_address: {
                                    [Op.or]: walletAddresses
                                }
                            },
                            {
                                type: 0
                            }
                        ]
                    },
                    order: [['tx_timestamp', 'DESC']]
                };
    
                const coinbase_list = await req.getModel('TransactionHistory').findAll(whereCondition);

                coinbase_history.push(...coinbase_list.map((x) => {
                    return {
                        "id": x["hash"],
                        "type": 'coinbase-history',
                        "attributes": {
                            "tfuel": x["tfuel"],
                            "type": x["type"],
                            "to-address": x["to_address"],
                            "value": x["tfuel"] / wei_divider,
                            "tfuel-price": x["tfuel"] / wei_divider * tfuel_price,
                            "timestamp": dateFormat(new Date(Number(x["tx_timestamp"]) * 1000), "isoDateTime"),
                        }
                    }
                }));

                return h.response({ data: coinbase_history });
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