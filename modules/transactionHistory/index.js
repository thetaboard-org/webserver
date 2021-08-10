const Boom = require('@hapi/boom');
const {Op} = require("sequelize");
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
const transactionHistory = function (server, options, next) {
    server.route({
        path: '/',
        method: 'GET',
        handler: async (req, h) => {
            try {
                // get transaction history
                const transaction_history = [];
                const pageNumber = req.query.pageNumber ? Number(req.query.pageNumber) : 1;
                const limitNumber = req.query.limitNumber ? Number(req.query.limitNumber) : 40;
                const offset = (pageNumber - 1) * limitNumber;
                const walletAddresses = typeof req.query["wallets[]"] == 'string' ? [req.query["wallets[]"]] : req.query["wallets[]"];

                let whereCondition = {
                    where: {
                        [Op.or]: [
                            {
                                from_address: {
                                    [Op.or]: walletAddresses
                                }
                            },
                            {
                                to_address: {
                                    [Op.or]: walletAddresses
                                }
                            }
                        ]
                    },
                    order: [['tx_timestamp', 'DESC']]
                };

                const [transaction_count, transaction_list] = await Promise.all([
                    req.getModel('TransactionHistory').count(whereCondition),
                    req.getModel('TransactionHistory').findAll({
                        where: whereCondition.where,
                        order: whereCondition.order,
                        limit: limitNumber,
                        offset: offset
                    })]);

                const pagination = {
                    currentPageNumber: pageNumber,
                    totalPageNumber: Math.ceil(transaction_count / limitNumber)
                };
                transaction_history.push(
                    ...transaction_list.map((x) => {

                        return {
                            "id": x["hash"] + x["from_address"] + x["to_address"],
                            "type": 'transaction-history',
                            "attributes": {
                                "in-or-out": walletAddresses.map((x) => x.toUpperCase()).includes(x["from_address"].toUpperCase()) ? "out" : "in",
                                "type": x["type"],
                                "txn-hash": x["hash"],
                                "block-height": x["block_height"],
                                "tx-timestamp": dateFormat(new Date(Number(x["tx_timestamp"]) * 1000), "isoDateTime"),
                                "status": x["status"],
                                "from-address": x["from_address"],
                                "to-address": x["to_address"],
                                "theta": x["theta"],
                                "tfuel": x["tfuel"],
                                "theta-amount": x["theta"] / wei_divider,
                                "tfuel-amount": x["tfuel"] / wei_divider,
                            }
                        }
                    }));

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