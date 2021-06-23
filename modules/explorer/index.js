const got = require('got');
const dateFormat = require("dateformat");

const wei_divider = 1000000000000000000;

// a middleware function with no mount path. This code is executed for every request to the router
const api_token = "API_TOKEN" in process.env && process.env.API_TOKEN ? process.env.API_TOKEN : null;
const theta_explorer_api_params = {
    https: {rejectUnauthorized: false},
}
if (api_token) {
    theta_explorer_api_params.headers = {"x-api-token": api_token}
}
const explorer = function (server, options, next) {
    server.ext('onRequest', async (req, h) => {
        if (req.query && req.query.env) {
            if (req.query.env === 'testnet') {
                req.theta_explorer_api_domain = "https://guardian-testnet-explorer.thetatoken.org:8443";
            } else if (req.query.env === 'smart-contracts') {
                req.theta_explorer_api_domain = "https://smart-contracts-sandbox-explorer.thetatoken.org:8443";
            }
        } else {
            req.theta_explorer_api_domain = "https://explorer.thetatoken.org:8443";
        }
        return h.continue;
    })

    server.route({
        path: '/prices',
        method: 'GET',
        handler: async (req, h) => {
            try {
                // get prices
                const prices = await got(`${req.theta_explorer_api_domain}/api/price/all`, theta_explorer_api_params);
                const tfuel_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'TFUEL')[0];
                const theta_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'THETA')[0];
                return h.response({
                    theta: theta_price,
                    tfuel: tfuel_price,
                });
            } catch (error) {
                return h.response(error.response.body).code(400);
            }
        }
    });

    server.route({
        path: '/totalStake',
        method: 'GET',
        handler: async (req, h) => {
            try {
                // get stake
                const stake = await got(`${req.theta_explorer_api_domain}/api/stake/totalAmount`, theta_explorer_api_params);
                return h.response(JSON.parse(stake.body).body);
            } catch (error) {
                return h.response(error.response.body).code(400);
            }
        }
    });

    server.route({
        path: '/totalTfuelStake',
        method: 'GET',
        handler: async (req, h) => {
            try {
                // get stake
                const stake = await got(`${req.theta_explorer_api_domain}/api/stake/totalAmount/tfuel`, theta_explorer_api_params);
                return h.response(JSON.parse(stake.body).body);
            } catch (error) {
                return h.response(error.response.body).code(400);
            }
        }
    });

    server.route({
        path: '/wallet-info/{wallet_addr}',
        method: 'GET',
        handler: async (req, h) => {
            const wallet_adr = req.params.wallet_addr;
            const response = [];
            try {
                // get price
                const prices = await got(`${req.theta_explorer_api_domain}/api/price/all`, theta_explorer_api_params);
                const tfuel_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'TFUEL')[0]['price'];
                const theta_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'THETA')[0]['price'];
                // get theta holding
                const holding = await got(`${req.theta_explorer_api_domain}/api/account/${wallet_adr}`, theta_explorer_api_params);

                const balances = JSON.parse(holding.body).body.balance;
                response.push({
                    "amount": balances['thetawei'] / wei_divider,
                    "type": "wallet",
                    "value": balances['thetawei'] / wei_divider * theta_price,
                    "market_price": theta_price,
                    "wallet_address": wallet_adr,
                    "node_address": null,
                    "currency": "theta"
                });
                response.push({
                    "amount": balances['tfuelwei'] / wei_divider,
                    "type": "wallet",
                    "value": balances['tfuelwei'] / wei_divider * tfuel_price,
                    "market_price": tfuel_price,
                    "wallet_address": wallet_adr,
                    "node_address": null,
                    "currency": "tfuel"
                });

                // get staked theta
                const staked_query = await got(`${req.theta_explorer_api_domain}/api/stake/${wallet_adr}`, theta_explorer_api_params);
                response.push(...JSON.parse(staked_query.body).body.sourceRecords.map((x) => {
                    return {
                        "amount": x["amount"] / wei_divider,
                        "type": "guardian",
                        "value": x["amount"] / wei_divider * theta_price,
                        "market_price": theta_price,
                        "wallet_address": x["source"],
                        "node_address": x["holder"],
                        "currency": "theta"
                    }
                }));

                return h.response({wallets: response})
            } catch (error) {
                return h.response(error.response.body).code(400);
            }
        }
    });

    server.route({
        path: '/wallet-transactions/{wallet_addr}',
        method: 'GET',
        handler: async (req, h) => {
            const wallet_adr = req.params.wallet_addr;

            try {
                // get price
                const prices = await got(`${req.theta_explorer_api_domain}/api/price/all`, theta_explorer_api_params);
                const tfuel_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'TFUEL')[0]['price'];
                const theta_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'THETA')[0]['price'];

                // get transaction history
                const transaction_history = [];
                const pageNumber = req.query.pageNumber ? req.query.pageNumber.toString() : '1';
                const limitNumber = req.query.limitNumber ? req.query.limitNumber.toString() : '15';
                const transaction_history_query = await got(`${req.theta_explorer_api_domain}/api/accounttx/${wallet_adr}?type=-1&pageNumber=${pageNumber}&limitNumber=${limitNumber}&isEqualType=false`,
                    theta_explorer_api_params);
                const transaction_list = JSON.parse(transaction_history_query.body);
                const pagination = {
                    currentPageNumber: transaction_list.currentPageNumber,
                    totalPageNumber: transaction_list.totalPageNumber
                };
                transaction_history.push(...transaction_list.body.map((x) => {
                    let from, to, values, typeName = null;
                    if (x["type"] == 0) {
                        from = x["data"]["proposer"];
                        to = x["data"]["outputs"].filter(x => x['address'].toUpperCase() === wallet_adr.toUpperCase())[0];
                        values = to;
                        typeName = "Coinbase";
                    } else if (x["type"] == 10) {
                        from = x["data"]["source"];
                        to = x["data"]["holder"];
                        values = from;
                        typeName = "Deposit Stake";
                    } else if (x["type"] == 2) {
                        from = x["data"]["inputs"][0];
                        if (x["data"]["outputs"].length == 1) {
                            to = x["data"]["outputs"][0];
                        } else {
                            to = x["data"]["outputs"].filter(x => x['address'].toUpperCase() === wallet_adr.toUpperCase())[0];
                        }
                        values = to;
                        typeName = "Transfer";
                    } else if (x["type"] == 9) {
                        to = x["data"]["source"];
                        from = x["data"]["holder"];
                        values = to;
                        typeName = "Withdraw Stake";
                    } else if (x["type"] == 7) {
                        from = x["data"]["from"];
                        to = x["data"]["to"];
                        values = to;
                        typeName = "Smart Contract";
                    } else {
                        new Error("we don't handle transactions of type : " + x["type"])
                    }

                    return {
                        "in_or_out": wallet_adr.toUpperCase() == from["address"].toUpperCase() ? "out" : "in",
                        "type": x["type"],
                        "typeName": typeName,
                        "txn_hash": x["hash"],
                        "block": x["block_height"],
                        "timestamp": dateFormat(new Date(Number(x["timestamp"]) * 1000), "isoDateTime"),
                        "status": x["status"],
                        "from_wallet_address": from["address"],
                        "to_wallet_address": to["address"],
                        "value": [{
                            "type": "theta",
                            "amount": values["coins"]["thetawei"] / wei_divider,
                            "value": values["coins"]["thetawei"] / wei_divider * theta_price
                        }, {
                            "type": "tfuel",
                            "amount": values["coins"]["tfuelwei"] / wei_divider,
                            "value": values["coins"]["tfuelwei"] / wei_divider * tfuel_price
                        }
                        ]
                    }
                }));

                return h.response({transactions: transaction_history, pagination: pagination})
            } catch (error) {
                return h.response(error.response.body).code(400);
            }
        }
    });
}


module.exports = {
    register: explorer,
    name: 'explorer',
    version: '1.0.0'
};