const mongoose = require('mongoose')
var Schema = mongoose.Schema;
var bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: {type: String, required: true, default: ''},
    email: {type: String, required: true, unique: true},
    email_verified: {type: Boolean, default: false},
    verify_token: {type: String, default: null},
    provider: {type: String, default: 'email'},
    provider_id: {type: String, default: null},
    password: {type: String},
    password_reset_token: {type: String, default: null},
    image: {type: String, default: null},
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now},
}, {
    collection: 'User'
});

module.exports = mongoose.model('User', userSchema);

module.exports.encryptPassword = function (password) {
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(password, salt, null);
    return hash;
}


module.exports.validPassword = function (password, hash) {
    return bcrypt.compareSync(password, hash);
}