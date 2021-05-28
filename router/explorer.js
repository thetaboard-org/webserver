const express = require('express');
const got = require('got');

const router = express.Router();
const dateFormat = require("dateformat");

const wei_divider = 1000000000000000000;

// a middleware function with no mount path. This code is executed for every request to the router
let theta_explorer_api_domain = "https://explorer.thetatoken.org:8443";

const api_token = "API_TOKEN" in process.env && process.env.API_TOKEN ? process.env.API_TOKEN : null;
const theta_explorer_api_params = {
    https: {rejectUnauthorized: false},
}
if (api_token) {
    theta_explorer_api_params.headers = {"x-api-token": api_token}
}


router.use(function (req, res, next) {
    if (req.query && req.query.env) {
        if (req.query.env === 'testnet') {
            theta_explorer_api_domain = "https://guardian-testnet-explorer.thetatoken.org:8443";
        } else if (req.query.env === 'smart-contracts') {
            theta_explorer_api_domain = "https://smart-contracts-sandbox-explorer.thetatoken.org:8443";
        }
    } else {
        theta_explorer_api_domain = "https://explorer.thetatoken.org:8443";
    }
    next();
});


router.get("/prices", async (req, res, next) => {
    try {
        // get prices
        const prices = await got(`${theta_explorer_api_domain}/api/price/all`, theta_explorer_api_params);
        const tfuel_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'TFUEL')[0];
        const theta_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'THETA')[0];
        res.json({
            theta: theta_price,
            tfuel: tfuel_price,
        });
    } catch (error) {
        res.status(400).json(error.response.body);
    }
});

router.get("/totalStake", async (req, res, next) => {
    try {
        // get stake
        const stake = await got(`${theta_explorer_api_domain}/api/stake/totalAmount`, theta_explorer_api_params);
        res.json(JSON.parse(stake.body).body);
    } catch (error) {
        res.status(400).json(error.response.body);
    }
});

// wallet infos
router.get("/wallet-info/:wallet_addr", async (req, res, next) => {
    const wallet_adr = req.params.wallet_addr;
    const response = [];
    try {
        // get price
        const prices = await got(`${theta_explorer_api_domain}/api/price/all`, theta_explorer_api_params);
        const tfuel_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'TFUEL')[0]['price'];
        const theta_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'THETA')[0]['price'];
        // get theta holding
        const holding = await got(`${theta_explorer_api_domain}/api/account/${wallet_adr}`, theta_explorer_api_params);

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
        const staked_query = await got(`${theta_explorer_api_domain}/api/stake/${wallet_adr}`, theta_explorer_api_params);
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

        res.json({wallets: response})
    } catch (error) {
        res.status(400).json(error.response.body);
    }
});

// wallet transactions
router.get("/wallet-transactions/:wallet_addr", async (req, res, next) => {
    const wallet_adr = req.params.wallet_addr;

    try {
        // get price
        const prices = await got(`${theta_explorer_api_domain}/api/price/all`, theta_explorer_api_params);
        const tfuel_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'TFUEL')[0]['price'];
        const theta_price = JSON.parse(prices.body).body.filter(x => x['_id'] === 'THETA')[0]['price'];

        // get transaction history
        const transaction_history = [];
        const pageNumber = req.query.pageNumber ? req.query.pageNumber.toString() : '1';
        const limitNumber = req.query.limitNumber ? req.query.limitNumber.toString() : '15';
        const transaction_history_query = await got(`${theta_explorer_api_domain}/api/accounttx/${wallet_adr}?type=-1&pageNumber=${pageNumber}&limitNumber=${limitNumber}&isEqualType=false`,
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
                toto = 1;
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

        res.json({transactions: transaction_history, pagination: pagination})
    } catch (error) {
        res.status(400).json(error.response.body);
    }
});


module.exports.router = router;