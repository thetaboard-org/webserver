module.exports = function (sequelize, DataTypes) {
    const User = sequelize.define('User', {
        // saves user email, validation of email address is done in payload
        userName: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        // hashed password is saved
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        // here we defines the user role like admin, customer, etc..
        scope: {
            type: DataTypes.ENUM,
            values: ['Admin', 'User'],
            defaultValue: 'User',
            allowNull: false
        },
        //it tells about the user account/email verification. By default it is false which is not verified and changes to true when account/email gets verified
        isVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    });


    return User;
};