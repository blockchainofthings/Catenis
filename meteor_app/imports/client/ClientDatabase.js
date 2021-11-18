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
        PaidService: new Mongo.Collection('PaidService'),
        ServicesCostHistory: new Mongo.Collection('ServicesCostHistory'),
        Billing: new Mongo.Collection('Billing'),
        BcotProduct: new Mongo.Collection('BcotProduct'),
        BcotSaleAllocation: new Mongo.Collection('BcotSaleAllocation'),
        BcotSaleStockInfo: new Mongo.Collection('BcotSaleStockInfo'),
        BcotSaleStockReplenishedAmount: new Mongo.Collection('BcotSaleStockReplenishedAmount'),
        TwoFactorAuthInfo: new Mongo.Collection('TwoFactorAuthInfo'),
        ClientOwnedDomain: new Mongo.Collection('ClientOwnedDomain'),
        StandbyPurchasedBcot: new Mongo.Collection('StandbyPurchasedBcot'),
        ClientForeignBlockchain: new Mongo.Collection('ClientForeignBlockchain'),
        ForeignBcConsumptionProfile: new Mongo.Collection('ForeignBcConsumptionProfile'),
        AvailableSelfRegBcotSale: new Mongo.Collection('AvailableSelfRegBcotSale'),
        UINotificationTemplate: new Mongo.Collection('UINotificationTemplate'),
        UINotification: new Mongo.Collection('UINotification'),
        CatenisUser: new Mongo.Collection('CatenisUser'),
        UserNotificationInfo: new Mongo.Collection('UserNotificationInfo'),
        UserNotification: new Mongo.Collection('UserNotification')
    }
};
