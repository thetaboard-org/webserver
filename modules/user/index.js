const user = function (server, options, next) {
    server.route({
        path: '/get_all',
        method: 'GET',
        handler: async (req, h) => {
            const users = await req.getModel('User').findAll();
            return h.response(users);
        }
    });
};


module.exports = {
    register: user,
    name: 'user',
    version: '1.0.0'
};