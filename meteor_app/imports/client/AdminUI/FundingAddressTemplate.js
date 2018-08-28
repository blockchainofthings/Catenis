/**
 * Created by Claudio on 2017-05-17.
 */

//console.log('[FundingAddressTemplate.js]: This code just ran.');

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
import { Catenis } from '../ClientCatenis';

// Import third-party client javascript
import qrcodelib from '../thirdParty/qrcode.min';

// Import template UI
import './FundingAddressTemplate.html';


// Module code
//

Template.fundingAddress.onCreated(function () {
    // Subscribe to receive information about payments to address
    this.addressPaymentSubs = this.subscribe('addressPayment', this.data.fundAddress);
});

Template.fundingAddress.onRendered(function () {
    const cnvCtrl = document.getElementById('cnvQRCode');

    qrcodelib.toCanvas(cnvCtrl, 'bitcoin:' + this.data.fundAddress, function (error) {
        if (error) {
            console.log('Error generating QRcode: ' + error);
        }
    });
});

Template.fundingAddress.onDestroyed(function () {
    if (this.addressPaymentSubs) {
        this.addressPaymentSubs.stop();
    }
});

Template.fundingAddress.helpers({
    receivedAmount() {
        return Catenis.db.collection.ReceivedAmount.findOne(1);
    }
});