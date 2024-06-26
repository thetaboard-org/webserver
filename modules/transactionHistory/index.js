const Boom = require('@hapi/boom');
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
const transactionHistory = function (server, options, next) {

    server.ext('onRequest', async (req, h) => {
        if (req.query && req.query.env) {
            if (req.query.env === 'testnet') {
                req.theta_explorer_api_domain = "https://guardian-testnet-explorer.thetatoken.org:8443";
            } else if (req.query.env === 'smart-contracts') {
                req.theta_explorer_api_domain = "https://smart-contracts-sandbox-explorer.thetatoken.org:8443";
            }
        } else {
            req.theta_explorer_api_domain = "https://explorer-api.thetatoken.org";
        }
        return h.continue;
    })

    server.route({
        path: '/',
        method: 'GET',
        handler: async (req, h) => {
            try {
                // get transaction history
                const pageNumber = req.query.pageNumber ? Number(req.query.pageNumber) : 1;
                const limitNumber = req.query.limitNumber ? Number(req.query.limitNumber) : 40;
                const offset = (pageNumber - 1) * limitNumber;
                const walletAddresses = typeof req.query["wallets[]"] == 'string' ? [req.query["wallets[]"].toLowerCase()] : req.query["wallets[]"].map((x) => x.toLowerCase());

                const transactions_collection = server.hmongoose.connection.models.transaction;
                const match = {
                    "$or": [...walletAddresses.map((wallet) => {
                        return {"from_address": wallet}
                    }),
                        ...walletAddresses.map((wallet) => {
                            return {"to_address": wallet}
                        })
                    ]
                }
                const [totalTx, transaction_list] = await Promise.all([transactions_collection.count(match),
                    transactions_collection.find(match).sort({timestamp: -1}).skip(offset).limit(limitNumber)]);
                const pagination = {
                    currentPageNumber: pageNumber,
                    totalPageNumber: Math.ceil(totalTx / limitNumber)
                };
                const transaction_history = transaction_list.map((x) => {
                    return {
                        "id": x["hash"] + x["from_address"] + x["to_address"],
                        "type": 'transaction-history',
                        "attributes": {
                            "in-or-out": walletAddresses.includes(x["from_address"]) ? "out" : "in",
                            "type": x["type"],
                            "txn-hash": x["hash"],
                            "block-height": x["block_height"],
                            "tx-timestamp": dateFormat(x["timestamp"], "isoDateTime"),
                            "status": x["status"],
                            "from-address": x["from_address"],
                            "to-address": x["to_address"],
                            "theta": x["theta"],
                            "tfuel": x["tfuel"],
                            "theta-amount": x["theta"] / wei_divider,
                            "tfuel-amount": x["tfuel"] / wei_divider,
                        }
                    }
                });

                return h.response({data: transaction_history, meta: {pagination: pagination}})
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
    register: transactionHistory,
    name: 'transactionHistory',
    version: '1.0.0'
};