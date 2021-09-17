const got = require('got');
const Web3 = require('web3')
const thetajs = require("@thetalabs/theta-js");

const fs = require('fs');
global.fetch = require("node-fetch");
const LOOP_EVERY = 30 * 1000 // 30 sec

const TNT20ContractABI = require("./ThetaboardNFT_abi.json");
const TNT20ContractAddress = "0x053CD0e05e6df3990ee35BD7a640B5AA92e77176";
const config = require(`${__dirname.split('webserver')[0]}webserver/config/secrets`)
const privateKey = config.wallets.smart_contracts;


const provider = new thetajs.providers.HttpProvider(thetajs.networks.Mainnet.chainId);
const wallet = new thetajs.Wallet(privateKey, provider);

// The Contract object
const tnt20Contract = new thetajs.Contract(TNT20ContractAddress, TNT20ContractABI, wallet);

const api_token = "API_TOKEN" in process.env && process.env.API_TOKEN ? process.env.API_TOKEN : null;


const theta_explorer_api_params = {
    https: {rejectUnauthorized: false},
}
if (api_token) {
    theta_explorer_api_params.headers = {"x-api-token": api_token}
}

const last_block_done = Number(fs.readFileSync(`${__dirname}/last_block_done`).toString());

async function get_and_mint() {
    const transaction_history_query = await got(`https://explorer.thetatoken.org:8443/api/accounttx/0xbdfc0c687861a65f54211c55e4c53a140fe0bf32?type=2`, theta_explorer_api_params);
    const transaction_list = JSON.parse(transaction_history_query.body);
    transaction_list.body.forEach((x) => {
        if (Number(Web3.utils.fromWei(x.data.inputs["0"].coins.tfuelwei)) >= 20 && last_block_done < Number(x.block_height)) {
            tnt20Contract.mint(x.data.inputs["0"].address);
        }
    })
    fs.writeFileSync(`${__dirname}/last_block_done`, transaction_list.body[0].block_height)
}


const infinite_loop = async () => {
    while (true) {
        get_and_mint()
        await new Promise(resolve => setTimeout(resolve, LOOP_EVERY));
    }
}
infinite_loop()




