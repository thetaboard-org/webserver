const bcrypt = require('bcrypt');
const saltRounds = 10;

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
                user.password = await bcrypt.hash(req.payload.user.password, saltRounds);
                try {
                    const saved = await user.save();
                    return {'success': true};
                } catch (e) {
                    return e.errors
                }
            }
        },
        {
            method: 'get',
            path: '/only_logged',
            options: {
                auth: {
                    strategy: 'token',
                },
                handler: async (req, h) => {
                    const user = await req.getModel('User').build(req.payload.user);
                    const myPlaintextPassword = 'lol';
                    const password = await bcrypt.hash(myPlaintextPassword, saltRounds);
                    const is_same = bcrypt.compare(myPlaintextPassword)
                    return user.save()
                }
            }
        },
    ]);
};


module.exports = {
    register: user,
    name: 'user',
    version: '1.0.0'
};