const Boom = require('@hapi/boom')
const jwt = require('../utils/jwt')

const affiliate = function (server, options, next) {
    server.route([
        {
            path: '/',
            method: 'GET',
            options: {
                handler: async function (req, h) {
                    try {
                        if (!req.query.name) {
                            throw "Affiliate not found";
                        }
                        const affiliate = await req.getModel('Affiliate').findOne({where: {'name': req.query.name}});
                        if (!affiliate) {
                            throw "Affiliate not found";
                        }
                        return { "data": affiliate.toJSON()};
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
    register: affiliate,
    name: 'affiliate',
    version: '1.0.0'
};