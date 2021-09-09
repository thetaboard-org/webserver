const Boom = require('@hapi/boom')
const stringify = require('csv-stringify');
const {Op} = require("sequelize");
const wei_divider = 1000000000000000000;
const dateFormat = require("dateformat");

const transactionExport = function (server, options, next) {
    server.route([
        {
            method: 'GET',
            path: '/',
            options: {
                // auth: {
                //     strategy: 'token',
                // },
                handler: async (req, h) => {
                    try {
                        // const user = await req.getModel('User').findOne({where: {'email': req.auth.credentials.email}});
                        // if (!user) {
                        //     throw "Request invalid";
                        // }
                        const start_date_raw = req.query["startDate"];
                        const end_date_raw = req.query["endDate"];
                        if (!start_date_raw || !end_date_raw) {
                            throw "Request invalid: missing dates";
                        }

                        const wallet_addresses = req.query["wallets"].split(',');
                        if (!wallet_addresses) {
                            throw "Request invalid: missing wallet addresse";
                        }

                        const currency = req.query["currency"];
                        if (!currency) {
                            throw "Request invalid: missing currency";
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
                                //check if type 2 
                                //check is in or out for add or substract
                                transaction["typeName"] = "Transfer";
                            } else if (transaction["type"] === 9) {
                                transaction["typeName"] = "Withdraw Stake";
                            } else if (transaction["type"] === 10) {
                                transaction["typeName"] = "Deposit Stake";
                            }
                            
                            return buildPayload(transaction, prices, currency);
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

buildPayload = function(transaction, prices, currency) {
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