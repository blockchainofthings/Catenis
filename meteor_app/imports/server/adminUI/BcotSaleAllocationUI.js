/**
 * Created by Claudio on 2018-12-12.
 */

//console.log('[BcotSaleAllocationUI.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import {
    BcotSaleAllocation,
    cfgSettings as bcotSaleAllocCfgSettings
} from '../BcotSaleAllocation';
import { SelfRegistrationBcotSale } from '../SelfRegistrationBcotSale';

// Definition of function classes
//

// BcotSaleAllocationUI function class
export function BcotSaleAllocationUI() {
}


// Public BcotSaleAllocationUI object methods
//

/*BcotSaleAllocationUI.prototype.pub_func = function () {
 };*/


// Module functions used to simulate private BcotSaleAllocationUI object methods
//  NOTE: these functions need to be bound to a BcotSaleAllocationUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// BcotSaleAllocationUI function class (public) methods
//

BcotSaleAllocationUI.initialize = function () {
    Catenis.logger.TRACE('BcotSaleAllocationUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        createBcotSaleAllocation: function (productsToAllocate, forSelfRegistration) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return BcotSaleAllocation.createBcotSaleAllocation(productsToAllocate, forSelfRegistration);
                }
                catch (err) {
                    // Error trying to create new BCOT sale allocation. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new BCOT sale allocation.', util.inspect(productsToAllocate), err);
                    throw new Meteor.Error('bcotSaleAllocation.create.failure', 'Failure trying to create new BCOT sale allocation: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        getSelfRegistrationBcotSaleProduct: function () {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                return SelfRegistrationBcotSale.bcotProductSku;
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        getAllocProdsReportConfig: function () {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                return bcotSaleAllocCfgSettings.allocatedProductsReport;
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        generateAllocProdsReport: function (bcotSaleAllocation_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return Buffer.from(BcotSaleAllocation.getBcotSaleAllocationByDocId(bcotSaleAllocation_id).generateAllocatedProductsReport()).toString('base64');
                }
                catch (err) {
                    // Error trying to generate report of allocated BCOT products for sale. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to generate report of allocated BCOT products for sale (BCOT sale allocation doc/rec ID: %s).', bcotSaleAllocation_id, err);
                    throw new Meteor.Error('bcotSaleAllocation.create.failure', 'Failure to generate report of allocated BCOT products for sale: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        setBcotSaleAllocationInUse: function (bcotSaleAllocation_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return BcotSaleAllocation.getBcotSaleAllocationByDocId(bcotSaleAllocation_id).setInUse();
                }
                catch (err) {
                    // Error trying to generate report of allocated BCOT products for sale. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to set BCOT sale allocation in use (doc/rec ID: %s).', bcotSaleAllocation_id, err);
                    throw new Meteor.Error('bcotSaleAllocation.create.failure', 'Failure trying to set BCOT sale allocation in use: ' + err.toString());
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
    Meteor.publish('bcotSaleAllocations', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.BcotSaleAllocation.find({
                status: {
                    $ne: BcotSaleAllocation.status.self_registration.name
                }
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('bcotSaleAllocationRecord', function (bcotSaleAllocation_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.BcotSaleAllocation.find({
                _id: bcotSaleAllocation_id
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('availableSelfRegBcotSale', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            let availableQuantity = 0;

            this.added('AvailableSelfRegBcotSale', 1, {
                minimumQuantity: SelfRegistrationBcotSale.minimumAvailableQuantity,
                currentQuantity: availableQuantity
            });

            const observeHandle = Catenis.db.collection.SelfRegistrationBcotSale.find({
                status: SelfRegistrationBcotSale.itemStatus.available.name
            }, {
                fields: {
                    _id: 1
                }
            })
            .observe({
                added: () => {
                    this.changed('AvailableSelfRegBcotSale', 1, {
                        currentQuantity: ++availableQuantity
                    });
                },
                removed: () => {
                    this.changed('AvailableSelfRegBcotSale', 1, {
                        currentQuantity: --availableQuantity
                    });
                }
            });

            this.ready();

            this.onStop(() => {
                observeHandle.stop();
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


// BcotSaleAllocationUI function class (public) properties
//

/*BcotSaleAllocationUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BcotSaleAllocationUI);
