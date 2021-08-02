/**
 * Created by claudio on 2021-07-19
 */

//console.log('[AddressQRCodeTemplate.js]: This code just ran.');

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
import './AddressQRCodeTemplate.html';


// Definition of module (private) functions
//

function generateQRCode(template) {
    const cnvCtrl = document.getElementById('cnvQRCode');

    qrcodelib.toCanvas(cnvCtrl, template.data.address, function (error) {
        if (error) {
            console.error('Error generating QR code: ' + error);
        }
    });
}


// Module code
//

Template.addressQRCode.onRendered(function () {
    generateQRCode(this);
});

Template.addressQRCode.helpers({
    address() {
        return Template.instance().data.address;
    }
});