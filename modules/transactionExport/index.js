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

                        const wallet_addresses = req.query["wallets"].split(',');
                        if (!wallet_addresses) {
                            throw "Request invalid: missing wallet address";
                        }

                        const currency = req.query["currency"];
                        if (!currency) {
                            throw "Request invalid: missing currency";
                        }

                        // First we check if 50% of total wallets are staked with thetaboard
                        // then we build a array of json for each stake and see if it is thetaboard EN or not
                        const public_model = req.getModel('PublicEdgeNode');
                        const private_model = req.getModel('Tfuelstake');
                            const tfuel_staked = [].concat(...(await Promise.all(wallet_addresses.map(async (wallet_adr) => {
                            const holding = await got(`${req.theta_explorer_api_domain}/api/stake/${wallet_adr}?types[]=eenp`, theta_explorer_api_params);
                            const balances = await JSON.parse(holding.body);
                            return Promise.all(balances.body.sourceRecords.map(async (x) => {
                                const is_public = await public_model.count({
                                    where: {
                                        summary: {[Op.like]: x["holder"] + '%'}
                                    }
                                });
                                const is_private = await private_model.count({
                                    where: {
                                        summary: {[Op.like]: x["holder"] + '%'}
                                    }
                                });
                                return { "amount": x['amount'] / wei_divider, "is_stake_with_us": is_public || is_private }
                            }));
                        }))));

                        // compute the sum of all staked for thetaboard vs not thetaboard ENs
                        const sum_with_us_and_not = tfuel_staked.reduce((acc, el, i) => {
                            if (el["is_stake_with_us"]) {
                                acc[0] += el['amount'];
                            } else {
                                acc[1] += el['amount'];
                            }
                            return acc;
                        }, [0, 0]);
                        // Finally return error if not
                        if (sum_with_us_and_not[0] < sum_with_us_and_not[1]) {
                            return Boom.unauthorized("");
                        }

                        const start_date_tx = new Date(`${start_date_raw}:`).getTime()/1000;
                        const end_date_tx = new Date(`${end_date_raw}:`).getTime()/1000;
                        const [historic_prices, transaction_histories] = await Promise.all([
                            getHistoricPrices(req, start_date_raw, end_date_raw, currency),
                            getTransactionHistories(req, wallet_addresses, start_date_tx, end_date_tx),
                        ]);
                        
                        let finalList= [];

                        finalList.push(...transaction_histories.map((transaction) => {
                            const date = formatDate(new Date(Number(transaction["tx_timestamp"])*1000));
                            const prices =  historic_prices.filter(x=>x.date == date)[0];
                            if (transaction["type"] == 0) {
                                transaction["typeName"] = "Rewards";
                            } else if(transaction["type"] == 2) {
                                transaction["typeName"] = "Transfer";
                            } else if (transaction["type"] === 9) {
                                transaction["typeName"] = "Withdraw Stake";
                            } else if (transaction["type"] === 10) {
                                transaction["typeName"] = "Deposit Stake";
                            }
                            
                            return buildPayload(transaction, prices, currency, wallet_addresses);
                        }));

                        return stringify(finalList, {
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

formatDate = function(date) {
    var d = date ? new Date(date) : new Date(),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
};

buildPayload = function(transaction, prices, currency, wallet_addresses) {
    let result = {
        "Transaction Hash": transaction["hash"],
        "Timestamp": dateFormat(new Date(Number(transaction["tx_timestamp"]) * 1000), "isoDateTime"),
        "Transaction Type": transaction["typeName"] ? transaction["typeName"] : transaction["type"],
        "From": transaction["from_address"],
        "To": transaction["to_address"],
        "Theta Amount": transaction["theta"] / wei_divider,
        "Tfuel Amount": transaction["tfuel"] / wei_divider,
    }
    result[`Daily Average Theta Price in ${currency}`] = prices.theta_price;
    result[`Daily Average Tfuel Price in ${currency}`] = prices.tfuel_price;
    result[`Rewards Value in ${currency}`] = transaction["type"] == 0 ? prices.tfuel_price * transaction["tfuel"] / wei_divider : "NA";
    if (transaction["fee_tfuel"] != null) {
        if (transaction["type"] == 9 || wallet_addresses.includes(transaction["from_address"])) {
            result[`Fee in Tfuel`] = transaction.fee_tfuel / wei_divider;
            result[`Fee in ${currency}`] = prices.tfuel_price * transaction.fee_tfuel / wei_divider;        
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

getTransactionHistories = async function(req, wallet_addresses, start_date_tx, end_date_tx) {
    return await req.getModel('TransactionHistory').findAll({
        where: {
            [Op.or]: [
                {
                    from_address: {
                        [Op.or]: wallet_addresses
                    }
                },
                {
                    to_address: {
                        [Op.or]: wallet_addresses
                    }
                },
            ],
            type: {
                [Op.or]: [0, 2, 9, 10]
            },
            tx_timestamp: {
                [Op.between]: [start_date_tx, end_date_tx]
            },
        },
        order: [['tx_timestamp', 'DESC']]
    });
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