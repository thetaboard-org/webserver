const user = function (server, options, next) {
    server.route([{
        path: '/get_all',
        method: 'GET',
        handler: async (req, h) => {
            const users = await req.getModel('User').findAll();
            return h.response(users);
        }
    },
        {
            method: 'POST',
            path: '/',
            handler: async (req, h) => {
                const user = await req.getModel('User').build(req.payload.user);
                return user.save()
            }
        },
    ]);
};


module.exports = {
    register: user,
    name: 'user',
    version: '1.0.0'
};