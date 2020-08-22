/**
 * Created by claudio on 2020-08-19
 */
//console.log('[StandbyPurchasedBcotUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { BcotSaleAllocation } from '../BcotSaleAllocation';


// Definition of function classes
//

// StandbyPurchasedBcotUI function class
export function StandbyPurchasedBcotUI() {
}


// Public StandbyPurchasedBcotUI object methods
//

/*StandbyPurchasedBcotUI.prototype.pub_func = function () {
 };*/


// Module functions used to simulate private StandbyPurchasedBcotUI object methods
//  NOTE: these functions need to be bound to a StandbyPurchasedBcotUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// StandbyPurchasedBcotUI function class (public) methods
//

StandbyPurchasedBcotUI.initialize = function () {
    Catenis.logger.TRACE('StandbyPurchasedBcotUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        validatePurchasedBcot: function (purchaseCodes) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return BcotSaleAllocation.getRedeemBcotInfo(purchaseCodes) !== undefined;
                }
                catch (err) {
                    // Error trying to redeem purchased BCOT tokens. Log error and throw exception
                    Catenis.logger.ERROR('Failure validating purchased Catenis credits (purchase codes: %s).', purchaseCodes, err);
                    throw new Meteor.Error('standbyVoucher.validate.failure', 'Failure validating Catenis vouchers: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('standbyPurchasedBcot', function (client_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.StandbyPurchasedBcot.find({
                client_id: client_id
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// StandbyPurchasedBcotUI function class (public) properties
//

/*StandbyPurchasedBcotUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(StandbyPurchasedBcotUI);
