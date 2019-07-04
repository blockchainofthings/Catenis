/**
 * Created by Claudio on 2018-12-13.
 */

//console.log('[BcotSaleStockAddressTemplate.js]: This code just ran.');

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
import './BcotSaleStockAddressTemplate.html';


// Definition of module (private) functions
//

function generateQRCode(template) {
    const cnvCtrl = document.getElementById('cnvQRCode');

    qrcodelib.toCanvas(cnvCtrl, template.data.saleStockAddress, function (error) {
        if (error) {
            console.error('Error generating QRcode: ' + error);
        }
    });
}


// Module code
//

Template.bcotSaleStockAddress.onCreated(function () {
    // Subscribe to receive information about BCOT sale stock replenishment
    this.bcotSaleStockReplenishSubs = this.subscribe('bcotSaleStockReplenishment', this.data.saleStockAddress);
});

Template.bcotSaleStockAddress.onRendered(function () {
    generateQRCode(this);
    this.rendered = true;
});

Template.bcotSaleStockAddress.onDestroyed(function () {
    if (this.bcotSaleStockReplenishSubs) {
        this.bcotSaleStockReplenishSubs.stop();
    }
});

Template.bcotSaleStockAddress.helpers({
    _saleStockAddress() {
        const template = Template.instance();

        if (template.rendered) {
            generateQRCode(template);
        }

        return template.data.saleStockAddress;
    },
    replenishedAmount() {
        return Catenis.db.collection.BcotSaleStockReplenishedAmount.findOne(1);
    }
});
