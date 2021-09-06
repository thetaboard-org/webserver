const got = require('got');
const dateFormat = require("dateformat");
const Sequelize = require('sequelize');
const Boom = require("@hapi/boom");
const Op = Sequelize.Op;
const thetajs = require("@thetalabs/theta-js");
const nft_abi = require("./nft_abi.json")
const URL = require("url").URL;

global.fetch = require("node-fetch");

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

            const start_date = req.query.start_date;
            const end_date = req.query.end_date;
            const currency = req.query.currency ? req.query.currency : "USD";

            if (!server.methods.getPrice) {
                // 10min cache
                server.method('getPrice', getPrice, {
                    cache: {
                        expiresIn: 600 * 1000,
                        generateTimeout: 20000,

                    },
                    generateKey: function (...args) {
                        return args.filter((x) => !!x).join(',');
                    }
                });
            }

            async function getPrice(start_date = null, end_date = null, currency = null) {
                let historic_prices = [];
                if (start_date && end_date) {
                    historic_prices = await req.getModel('Price').findAll({
                            where: {
                                date: {
                                    [Op.between]: [start_date, end_date]
                                },
                                currency: currency
                            },
                            order: [['date', 'asc']]
                        }
                    );
                }

                // API calls for live info
                const [theta_price, blockCountPerHours, supply] = await Promise.all([
                    got(`https://api.coingecko.com/api/v3/simple/price?ids=theta-token%2Ctheta-fuel&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`).json(),
                    got(`${req.theta_explorer_api_domain}/api/blocks/number/1`, theta_explorer_api_params).json(),
                    got(`${req.theta_explorer_api_domain}/api/price/all`, theta_explorer_api_params).json()]);
                const secPerBlock = 3600 / (blockCountPerHours.body.total_num_block);
                const supply_theta = supply.body.find((x) => x._id === 'THETA');
                const supply_tfuel = supply.body.find((x) => x._id === 'TFUEL');
                return {
                    theta: {
                        "price": theta_price["theta-token"][currency.toLowerCase()],
                        "change_24h": theta_price["theta-token"][`${currency.toLowerCase()}_24h_change`],
                        "market_cap": theta_price["theta-token"][`${currency.toLowerCase()}_market_cap`],
                        "volume_24h": theta_price["theta-token"][`${currency.toLowerCase()}_24h_vol`],
                        "circulating_supply": supply_theta["circulating_supply"],
                        "total_supply": supply_theta["total_supply"],
                    },
                    tfuel: {
                        price: theta_price["theta-fuel"][currency.toLowerCase()],
                        "change_24h": theta_price["theta-fuel"][`${currency.toLowerCase()}_24h_change`],
                        "market_cap": theta_price["theta-fuel"][`${currency.toLowerCase()}_market_cap`],
                        "volume_24h": theta_price["theta-fuel"][`${currency.toLowerCase()}_24h_vol`],
                        "circulating_supply": supply_tfuel["circulating_supply"],
                        "total_supply": supply_tfuel["total_supply"],
                    },
                    dailyPrice: historic_prices.map(x => x.toJSON()['attributes']),
                    secPerBlock: secPerBlock,
                }

            }

            try {
                return await server.methods.getPrice(start_date, end_date, currency);
            } catch (error) {
                console.log(error);
                return Boom.badRequest(error);
            }
        }
    });

    server.route({
        path: '/totalStake',
        method: 'GET',
        handler: async (req, h) => {
            try {
                // get stake
                const stake = await got(`${req.theta_explorer_api_domain}/api/stake/totalAmount?type=theta`, theta_explorer_api_params);
                return h.response(JSON.parse(stake.body).body);
            } catch (error) {
                console.log(error);
                return Boom.badRequest(error);
            }
        }
    });

    server.route({
        path: '/totalTfuelStake',
        method: 'GET',
        handler: async (req, h) => {
            try {
                // get stake
                const stake = await got(`${req.theta_explorer_api_domain}/api/stake/totalAmount?type=tfuel`, theta_explorer_api_params);
                return h.response(JSON.parse(stake.body).body);
            } catch (error) {
                console.log(error);
                return Boom.badRequest(error);
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
                if (!wallet_adr) {
                    throw "No wallet address provided";
                }
                response.push(...await getWalletInfo(wallet_adr, req));
                return h.response({wallets: response})
            } catch (error) {
                console.log(error);
                return Boom.badRequest(error);
            }
        }
    });

    server.route({
        path: '/group-info/{group_uuid}',
        method: 'GET',
        handler: async (req, h) => {
            try {
                const group_uuid = req.params.group_uuid;
                const response = [];

                if (!group_uuid) {
                    throw "No Group id provided";
                }

                let group = await req.getModel('Group').findOne(
                    {
                        where: {'uuid': group_uuid},
                        include: {all: true}
                    }
                );
                if (!group) {
                    throw "No Group Found";
                }

                const promises = group.Wallets.map(async (wallet) => {
                    const wallet_adr = wallet.address;
                    let wallets = await getWalletInfo(wallet_adr, req);
                    if (wallets && wallets.length) {
                        response.push(...wallets);
                    }
                });

                return Promise.all(promises).then(() => h.response({wallets: response}));
            } catch (error) {
                console.log(error);
                return Boom.badRequest(error);
            }
        }
    });

    server.route({
        path: '/wallet-transactions/{wallet_addr}',
        method: 'GET',
        handler: async (req, h) => {
            const wallet_adr = req.params.wallet_addr;

            try {
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
                transaction_history.push(
                    ...transaction_list.body.map((x) => {
                        let from, to, values, typeName = null;
                        if (x["type"] == 0) {
                            from = x["data"]["proposer"];
                            to = x["data"]["outputs"].filter(x => x['address'].toUpperCase() === wallet_adr.toUpperCase())[0];
                            values = to ? to : from;
                            typeName = "Coinbase";
                        } else if (x["type"] == 10) {
                            from = x["data"]["source"];
                            to = x["data"]["holder"];
                            values = from;
                            typeName = "Deposit Stake";
                        } else if (x["type"] == 2) {
                            from = x["data"]["inputs"][0];
                            to = x["data"]["outputs"].filter(x => x['address'].toUpperCase() === wallet_adr.toUpperCase())[0] || x["data"]["outputs"][0];
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
                        } else if (x["type"] == 11) {
                            from = x["data"]["holder"];
                            to = x["data"]["beneficiary"];
                            values = from;
                            typeName = "Stake Reward Distribution";
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
                            "to_wallet_address": to ? to["address"] : '',
                            "value": [{
                                "type": "theta",
                                "amount": values["coins"]["thetawei"] / wei_divider,
                            }, {
                                "type": "tfuel",
                                "amount": values["coins"]["tfuelwei"] / wei_divider,
                            }
                            ]
                        }
                    }));

                return h.response({transactions: transaction_history, pagination: pagination})
            } catch (error) {
                return Boom.badRequest(error);
            }
        }
    });


    server.route({
        path: '/wallet-nft/{wallet_adr}',
        method: 'GET',
        handler: async (req, h) => {
            const wallet_adr = req.params.wallet_adr;
            const provider = new thetajs.providers.HttpProvider(thetajs.networks.ChainIds.Mainnet);

            const contracts_for_wallet = [];
            let index = 0;
            while (true) {
                const get_contracts_for_wallet = await got(`https://www.thetascan.io/api/nft/?address=${wallet_adr.toLowerCase()}&index=${index}`);
                const contracts_adr = JSON.parse(get_contracts_for_wallet.body);
                if (!!contracts_adr) {
                    contracts_for_wallet.push(...contracts_adr);
                    index++;
                } else {
                    break
                }
            }


            const get_nft_info_721 = async (contract_adr, token_id) => {
                const contract = new thetajs.Contract(contract_adr, nft_abi, provider);
                const token_uri = await contract.tokenURI(token_id);
                const parsed = new URL(token_uri);


                const obj = {
                    "type": null, // type is best effort to guess
                    "url": null,
                    "name": null,
                };

                // if contract is a json, then it is a NFT made by thetadrop
                // we assume we need to fetch it to get more info about it
                if (parsed.pathname.endsWith(".json")) {
                    try {
                        const nft_metadata_api = await fetch(token_uri)
                        const nft_metadata = await nft_metadata_api.json();
                        obj['url'] = nft_metadata['image'];
                        obj['name'] = `${nft_metadata['name']}`;
                    } catch (e) {
                        // URL is invalid. Nothing we can do about it...
                        return null;
                    }
                } else {
                    obj['url'] = token_uri;
                    obj['name'] = `${await contract.name()}`;
                }
                try {
                    new URL(obj['url']);
                    obj['type'] = 'image';
                } catch (err) {
                    obj['type'] = 'unknown';
                }
                return obj;
            }

            let NFTs = []
            if (contracts_for_wallet) {
                NFTs = await Promise.all(contracts_for_wallet.map(async (contract_idx) => {
                    return get_nft_info_721(contract_idx['contract'], contract_idx['token']);
                }))
            }
            return NFTs.filter((x) => !!x);
        }
    });
}


const getWalletInfo = async function (wallet_adr, req) {
    let response = [];
    // get theta holding
    const holding = await got(`${req.theta_explorer_api_domain}/api/account/${wallet_adr}`, theta_explorer_api_params);

    const balances = await JSON.parse(holding.body).body.balance;
    response.push({
        "amount": balances['thetawei'] / wei_divider,
        "type": "wallet",
        "wallet_address": wallet_adr,
        "node_address": null,
        "currency": "theta"
    });
    response.push({
        "amount": balances['tfuelwei'] / wei_divider,
        "type": "wallet",
        "wallet_address": wallet_adr,
        "node_address": null,
        "currency": "tfuel"
    });

    // get staked theta/tfuel
    const staked_query = await got(`${req.theta_explorer_api_domain}/api/stake/${wallet_adr}?types[]=vcp&types[]=gcp&types[]=eenp`, theta_explorer_api_params);
    response.push(...JSON.parse(staked_query.body).body.sourceRecords.map((x) => {
        let result = {
            "amount": x["amount"] / wei_divider,
            "wallet_address": x["source"],
            "node_address": x["holder"],
        }
        if (x["type"] == "gcp") {
            result.type = "Guardian Node";
            result.currency = "theta";
        } else if (x["type"] == "eenp") {
            result.type = "Elite Edge Node";
            result.currency = "tfuel";
        } else if (x["type"] == "vcp") {
            result.type = "Validator Node";
            result.currency = "theta";
        }
        return result;
    }));
    return response
}


module.exports = {
    register: explorer,
    name: 'explorer',
    version: '1.0.0'
};