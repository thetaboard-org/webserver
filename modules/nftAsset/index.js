const Boom = require('@hapi/boom')

const nftAsset = function (server, options, next) {
    server.route([
        {
            path: '/{id}',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        const rawNftAsset = await req.getModel('NFTAsset').findOne({where: {'id': req.params.id}});
                        let response = {"data": {}};
                        if (rawNftAsset) {
                            let nftAsset = rawNftAsset.toJSON();
                            response.data = nftAsset;
                        }
                        return response;
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


module.exports = {
    register: nftAsset,
    name: 'nftAsset',
    version: '1.0.0'
};