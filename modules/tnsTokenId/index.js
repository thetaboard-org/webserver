const Boom = require('@hapi/boom')
const { ethers } = require("ethers");

const tnsTokenId = function (server, options, next) {
    server.route([
        {
            method: 'POST',
            path: '/',
            options: {
                // auth: {
                //     strategy: 'token',
                // },
                handler: async (req, h) => {
                    try {
                        const labelHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(req.payload.data.attributes.name))
                        const tokenId = ethers.BigNumber.from(labelHash).toString()

                        if (tokenId == req.payload.data.attributes.tokenId) {
                            let tnsTokenId = await req.getModel('TnsTokenId').build(req.payload.data.attributes);                        
                            const savedTnsTokenId = await tnsTokenId.save();
                            let response = {"data": {}};
                            let payload = savedTnsTokenId.toJSON();
                            response.data = payload;
                            return response;
                        }
                        throw "incorrect tokenId"
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        },
        {
            method: 'GET',
            path: '/{tokenId}',
            options: {
                // auth: {
                //     strategy: 'token',
                // },
                handler: async (req, h) => {
                    try {
                        const tnsTokenId = await req.getModel('TnsTokenId').findOne({where: {'tokenId': req.params.tokenId}});
                        let response = {"data": {}};
                        const data = tnsTokenId.toJSON();
                        response.data = data;
                        return response;
                    } catch (e) {
                        if (e && e.errors) {
                            e = e.errors[0].message;
                        }
                        return Boom.badRequest(e);
                    }
                }
            }
        }
    ]);
};

module.exports = {
    register: tnsTokenId,
    name: 'tnsTokenId',
    version: '1.0.0'
};