/**
 * Created by peter on 7/27/17.
 */


//created to allow email content modification and password reset.

//configure smtp server
smtp = {
    username: "makeitpossibleseongun@gmail.com", //server email
    password: "XXXXXXXX", // email password
    server:   "smtp.gmail.com", //server domain
    port: 465,
};

process.env.MAIL_URL = 'smtps://' + encodeURIComponent(smtp.username) + ':' + encodeURIComponent(smtp.password) + '@' + encodeURIComponent(smtp.server) + ':' + smtp.port;

Accounts.urls.resetPassword = function(token) {
    return Meteor.absoluteUrl('reset-password/' + token);
};

Accounts.urls.enrollAccount = function(token) {
    return Meteor.absoluteUrl('enroll-account/' + token);
};


//******change email content*******

//1. RESET PASSWORD EMAIL
Accounts.emailTemplates.resetPassword.subject = (user) => {
    return "Catenis Password Reset";
};
Accounts.emailTemplates.resetPassword.text = (user, url) => {
    return "Welcome again to Catenis\n\n Click this link to reset your password: "+url +"\n\n";
};


//2. ENROLL ACCOUNT EMAIL
Accounts.emailTemplates.enrollAccount.subject = (user) => {
    return "Catenis Enroll Account";
};
Accounts.emailTemplates.enrollAccount.text = (user, url) => {
    return "Welcome to Catenis\n\n Click this link to set your password: "+url +"\n\n";
};
