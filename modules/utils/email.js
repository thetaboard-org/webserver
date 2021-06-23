const nodemailer = require("nodemailer"),
    Config = require('../../config/secrets.json');


const smtpTransport = nodemailer.createTransport(`smtps://${encodeURIComponent(Config.email.username)}:${encodeURIComponent(Config.email.password)}@smtp.gmail.com:465");`)
const host = process.env.NODE_ENV === 'production' ? 'https://thetaboard.io' : 'http://localhost:8000'

exports.sentMailVerificationLink = function (user, token) {
    const from = `Thetaboard Team < ${Config.email.username} > `;
    const mailbody = ` <p> Thanks for Registering on Thetaboard </p>
                        <p>Please verify your email by clicking on the verification link below.<br/>
                            <a href='${host}/verify/${token}'>Verification Link</a>
                        </p>`;
    mail(from, user.email, "Account Verification", mailbody);
};


exports.sentMailForgotPassword = function (user, token) {
    const from = ` Thetaboard Team < ${Config.email.username} > `;
    const mailbody = `<p>You requested a reset password.</p>
        <p>Please use the following link to reset your password.<br/>
        <a href='${host}/passwordreset/${token}'>Reset password</a>
        </p>`;
    mail(from, user.email, "Reset password", mailbody);
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