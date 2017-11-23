/**
 * Created by claudio on 15/05/17.
 */

//console.log('[Module_name.js]: This code just ran.');

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
import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// References code in other (Catenis) modules on the client
import { Catenis } from './ClientCatenis';


// Module code
//

// References to database collections used on the client
Catenis.db = {
    collection: {
        FundingBalanceInfo: new Mongo.Collection('FundingBalanceInfo'),
        ReceivedAmount: new Mongo.Collection('ReceivedAmount'),
        Client: new Mongo.Collection('Client'),
        Device: new Mongo.Collection('Device')
    }
};