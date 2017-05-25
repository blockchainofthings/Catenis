/**
 * Created by claudio on 17/05/17.
 */

//console.log('[FundingAddressTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

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