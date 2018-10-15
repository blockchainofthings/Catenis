/**
 * Created by Claudio on 2017-05-15.
 */

//console.log('[ClientDatabase.js]: This code just ran.');

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
        ClientLicense: new Mongo.Collection('ClientLicense'),
        License: new Mongo.Collection('License'),
        Device: new Mongo.Collection('Device'),
        ServiceAccountBalance: new Mongo.Collection('ServiceAccountBalance'),
        ReceivedBcotAmount: new Mongo.Collection('ReceivedBcotAmount'),
        BcotTokenPrice: new Mongo.Collection('BcotTokenPrice'),
        ClientDevicesInfo: new Mongo.Collection('ClientDevicesInfo'),
        PaidService: new Mongo.Collection('PaidService')
    }
};
