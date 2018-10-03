/**
 * Created by Claudio on 2018-01-08.
 */

//console.log('[BcoTPaymentAddressTemplate.js]: This code just ran.');

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
import './BcotPaymentAddressTemplate.html';


// Module code
//

Template.bcotPaymentAddress.onCreated(function () {
    // Subscribe to receive information about BCOT token payments to address
    this.bcotPaymentSubs = this.subscribe('bcotPayment', this.data.bcotPayAddress);
});

Template.bcotPaymentAddress.onRendered(function () {
    const cnvCtrl = document.getElementById('cnvQRCode');

    qrcodelib.toCanvas(cnvCtrl, 'bitcoin:' + this.data.bcotPayAddress, function (error) {
        if (error) {
            console.log('Error generating QRcode: ' + error);
        }
    });
});

Template.bcotPaymentAddress.onDestroyed(function () {
    if (this.bcotPaymentSubs) {
        this.bcotPaymentSubs.stop();
    }
});

Template.bcotPaymentAddress.helpers({
    receivedBcotAmount() {
        return Catenis.db.collection.ReceivedBcotAmount.findOne(1);
    }
});