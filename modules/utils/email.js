const nodemailer = require("nodemailer"),
    Config = require('../../config/secrets.json'),
    fs = require('fs');


const smtpTransport = nodemailer.createTransport(`smtps://${encodeURIComponent(Config.email.username)}:${encodeURIComponent(Config.email.password)}@smtp.gmail.com:465");`)
const host = process.env.NODE_ENV === 'production' ? 'https://thetaboard.io' : 'http://localhost:8000'

const injectTemplate = (str, obj) => str.replace(/\${(.*?)}/g, (x, g) => obj[g]);

exports.sentMailVerificationLink = function (user, token) {
    const from = `Thetaboard Team < ${Config.email.username} > `;
    const mailbody = fs.readFileSync(require.resolve('./templates/account_verification.html')).toString();
    const mailBodyWithVars = injectTemplate(mailbody, {host: host, token: token})
    mail(from, user.email, "Account Verification", mailBodyWithVars);
};


exports.sentMailForgotPassword = function (user, token) {
    const from = ` Thetaboard Team < ${Config.email.username} > `;
    const mailbody = fs.readFileSync(require.resolve('./templates/password_reset.html')).toString();
    const mailBodyWithVars = injectTemplate(mailbody, {host: host, token: token})
    mail(from, user.email, "Reset password", mailBodyWithVars);
};

function mail(from, email, subject, mailbody) {
    const mailOptions = {
        from: from, // sender address
        to: email, // list of receivers
        subject: subject, // Subject line
        //text: result.price, // plaintext body
        html: mailbody  // html body
    };

    smtpTransport.sendMail(mailOptions, function (error, response) {
        if (error) {
            console.error(error);
        }
        smtpTransport.close(); // shut down the connection pool, no more messages
    });
}