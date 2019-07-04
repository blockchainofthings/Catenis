/**
 * Created by Claudio on 2019-06-28.
 */

//console.log('[TwoFactorAuthenticationSecret.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
//import { Catenis } from '../ClientCatenis';

// Import third-party client javascript
import qrcodelib from '../thirdParty/qrcode.min';

// Import template UI
import './TwoFactorAuthenticationSecretTemplate.html';


// Definition of module (private) functions
//

function generateQRCode(template) {
    const cnvCtrl = document.getElementById('cnvQRCode');

    qrcodelib.toCanvas(cnvCtrl, template.data.authUri, function (error) {
        if (error) {
            console.error('Error generating QRcode: ' + error);
        }
    });
}


// Module code
//

Template.twoFactorAuthenticationSecret.onRendered(function () {
    generateQRCode(this);
    this.rendered = true;
});

Template.twoFactorAuthenticationSecret.helpers({
    _secret() {
        const template = Template.instance();

        if (template.rendered) {
            generateQRCode(template);
        }

        return template.data.secret;
    }
});