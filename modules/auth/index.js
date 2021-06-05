const auth = function (server, options, next) {
    /**
     * Register 'google' authentication strategy
     */
    server.auth.strategy('google', 'bell', {
        provider: 'google',
        password: 'cookie_encryption_password_secure',
        isSecure: process.env.NODE_ENV === 'production',
        clientId: '1012666492630-k6173ufjl9iucaku8hvdnf44ubhrpvk1.apps.googleusercontent.com',
        clientSecret: 'vvPAYlblV3B02qTvNAPLIYas',
        location: process.env.NODE_ENV === 'production' ? 'https://thetaboard.io' : 'http://localhost:8000'
    });


    /**
     * Register session based auth strategy to store
     * credentials received from GitHub and keep
     * the user logged in
     */
    // server.auth.strategy('session', 'cookie', {
    //     password: 'mySecret', //TODO: secure this as well !
    //     redirectTo: '/',
    //     isSecure: process.env.NODE_ENV === 'production'
    // })

    server.route({
        method: 'GET',
        path: '/google',
        options: {
            auth: {
                strategy: 'google',
                mode: 'try'
            },
            handler: function (request, h) {

                if (!request.auth.isAuthenticated) {
                    return 'Authentication failed due to: ' + request.auth.error.message;
                }

                return '<pre>' + JSON.stringify(request.auth.credentials, null, 4) + '</pre>';
            }
        }
    });

}


module.exports = {
    register: auth,
    name: 'auth',
    version: '1.0.0'
};