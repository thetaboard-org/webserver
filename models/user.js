module.exports = function (sequelize, DataTypes) {
    const User = sequelize.define('User', {
            // saves user email, validation of email address is done in payload
            email: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: {
                    msg: 'This email address is already taken.'
                },
                validate: {
                    isEmail: {
                        msg: "Email address invalid",
                    }
                }
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
        },
        {
            associate: function(models) { //create associations/foreign key constraint
                Users.hasMany(models.Tfuelstakes, {foreignKeyConstraint: true});
                Users.hasMany(models.Wallets, {foreignKeyConstraint: true});
                Users.hasMany(models.Affiliates, {foreignKeyConstraint: true});
            }
        },
        {
            indexes: [{
                fields: ['email'],
                unique: true,
            }]
        });

    User.prototype.toJSON = function () {
        const values = Object.assign({}, this.get());
        delete values.scope;
        delete values.password;
        return values;
    }
    return User;
};

