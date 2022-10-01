const Boom = require('@hapi/boom')
const stringify = require('csv-stringify');
const {Op} = require("sequelize");
const wei_divider = 1000000000000000000;
const dateFormat = require("dateformat");
const got = require('got');

// a middleware function with no mount path. This code is executed for every request to the router
const api_token = "API_TOKEN" in process.env && process.env.API_TOKEN ? process.env.API_TOKEN : null;
const theta_explorer_api_params = {
    https: {rejectUnauthorized: false},
}
if (api_token) {
    theta_explorer_api_params.headers = {"x-api-token": api_token}
}

const transactionExport = function (server, options, next) {

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

    server.route([
        {
            method: 'GET',
            path: '/',
            options: {
                handler: async (req, h) => {
                    try {
                        const start_date_raw = req.query["startDate"];
                        const end_date_raw = req.query["endDate"];
                        if (!start_date_raw || !end_date_raw) {
                            throw "Request invalid: missing dates";
                        }

                        const wallet_addresses = req.query["wallets"].split(',').map((x) => x.toLowerCase());
                        if (!wallet_addresses) {
                            throw "Request invalid: missing wallet address";
                        }

                        const currency = req.query["currency"];
                        if (!currency) {
                            throw "Request invalid: missing currency";
                        }

                        const start_date_tx = new Date(`${start_date_raw}:`);
                        const end_date_tx = new Date(`${end_date_raw}:`);
                        const [historic_prices, transaction_histories] = await Promise.all([
                            getHistoricPrices(req, start_date_raw, end_date_raw, currency),
                            getTransactionHistories(req, wallet_addresses, start_date_tx, end_date_tx),
                        ]);

                        const finalList = transaction_histories.map((transaction) => {
                            const date = formatDate(transaction["timestamp"]);
                            const prices = historic_prices.find(x => x.date === date);
                            return buildPayload(transaction, prices, currency, wallet_addresses);
                        });

                        return stringify.stringify(finalList, {
                            header: true
                        }, function (err, dataCSV) {
                            return h.response(dataCSV)
                                .header('Content-Type', 'text/csv')
                                .header('Content-Disposition', 'attachment; filename=export.csv;');
                        });
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        },
    ]);
};

formatDate = function (date) {
    var d = date ? new Date(date) : new Date(),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
};

buildPayload = function (transaction, prices, currency, wallet_addresses) {
    const result = {
        "Transaction Hash": transaction["hash"],
        "Timestamp": dateFormat(transaction["timestamp"], "isoDateTime"),
        "Transaction Type": null,
        "From": transaction["from_address"],
        "To": transaction["to_address"],
        "Theta Amount": transaction["theta"] / wei_divider,
        "Tfuel Amount": transaction["tfuel"] / wei_divider,
    }
    result[`Daily Average Theta Price in ${currency}`] = prices.theta_price;
    result[`Daily Average Tfuel Price in ${currency}`] = prices.tfuel_price;
    result[`Rewards Value in ${currency}`] = transaction["type"] === 0 ? prices.tfuel_price * transaction["tfuel"] / wei_divider : "NA";

    if (transaction["type"] === 0) {
        result["Transaction Type"] = "Rewards";
    } else if (transaction["type"] === 2) {
        result["Transaction Type"] = "Transfer";
    } else if (transaction["type"] === 9) {
        result["Transaction Type"] = "Withdraw Stake";
    } else if (transaction["type"] === 10) {
        result["Transaction Type"] = "Deposit Stake";
    } else {
        result["Transaction Type"] = transaction["type"];
    }

    if (transaction["fee_tfuel"]) {
        if (transaction["type"] === 9 || wallet_addresses.includes(transaction["from_address"])) {
            result[`Fee in Tfuel`] = transaction["fee_tfuel"] / wei_divider;
            result[`Fee in ${currency}`] = prices.tfuel_price * transaction["fee_tfuel"] / wei_divider;
        } else {
            result[`Fee in Tfuel`] = "NA";
            result[`Fee in ${currency}`] = "NA";
        }
    } else {
        result[`Fee in Tfuel`] = "NA";
        result[`Fee in ${currency}`] = "NA";
    }

    return result;
};

getTransactionHistories = async function (req, wallet_addresses, start_date_tx, end_date_tx) {
    const transactions_collection = req.server.hmongoose.connection.models.transaction;
    const match = {
        "$and": [
            {
                "$or": [...wallet_addresses.map((wallet) => {
                    return {"from_address": wallet}
                }),
                    ...wallet_addresses.map((wallet) => {
                        return {"to_address": wallet}
                    })
                ]
            },
            {
                type: {
                    "$in": [0, 2, 9, 10]
                }
            },
            {
                timestamp: {$gte: start_date_tx, $lte: end_date_tx}
            },
        ]
    }
    return transactions_collection.find(match).sort({"timestamp": -1});
};

getHistoricPrices = async function (req, start_date_raw, end_date_raw, currency) {
    return await req.getModel('Price').findAll({
        where: {
            date: {
                [Op.between]: [start_date_raw, end_date_raw]
            },
            currency: currency
        },
        order: [['date', 'asc']]
    });
};

module.exports = {
    register: transactionExport,
    name: 'transactionExport',
    version: '1.0.0'
};