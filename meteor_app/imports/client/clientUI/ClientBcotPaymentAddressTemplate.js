/**
 * Created by Claudio on 2018-10-11.
 */

//console.log('[ClientBcotPaymentAddressTemplate.js]: This code just ran.');

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
import './ClientBcotPaymentAddressTemplate.html';


// Module code
//

Template.clientBcotPaymentAddress.onCreated(function () {
    // Subscribe to receive database docs/recs updates
    this.clientBcotPaymentSubs = this.subscribe('clientBcotPayment', this.data.bcotPayAddress);
});

Template.clientBcotPaymentAddress.onRendered(function () {
    const cnvCtrl = document.getElementById('cnvQRCode');

    qrcodelib.toCanvas(cnvCtrl, 'bitcoin:' + this.data.bcotPayAddress, function (error) {
        if (error) {
            console.log('Error generating QRcode: ' + error);
        }
    });
});

Template.clientBcotPaymentAddress.onDestroyed(function () {
    if (this.clientBcotPaymentSubs) {
        this.clientBcotPaymentSubs.stop();
    }
});

Template.clientBcotPaymentAddress.helpers({
    receivedBcotAmount() {
        return Catenis.db.collection.ReceivedBcotAmount.findOne(1);
    }
});
