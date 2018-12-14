/**
 * Created by Claudio on 2018-12-11.
 */

//console.log('[BcotSaleTemplate.js]: This code just ran.');

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

// Import template UI
import './BcotSaleTemplate.html';

// Import dependent templates
import './BcotProductsTemplate.js';
import './BcotSaleAllocationsTemplate.js';
import './BcotSaleStockTemplate.js';


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.bcotSale.onCreated(function () {
});

Template.bcotSale.onDestroyed(function () {
});

Template.bcotSale.events({
});

Template.bcotSale.helpers({
});
