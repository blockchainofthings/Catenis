/**
 * Created by Claudio on 2018-12-11.
 */

//console.log('[BcotProductsUI.js]: This code just ran.');

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
import { BcotProduct } from '../BcotProduct';

// Definition of function classes
//

// BcotProductsUI function class
export function BcotProductsUI() {
}


// Public BcotProductsUI object methods
//

/*BcotProductsUI.prototype.pub_func = function () {
 };*/


// Module functions used to simulate private BcotProductsUI object methods
//  NOTE: these functions need to be bound to a BcotProductsUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
 }*/


// BcotProductsUI function class (public) methods
//

BcotProductsUI.initialize = function () {
    Catenis.logger.TRACE('BcotProductsUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        createBcotProduct: function (productInfo) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    return BcotProduct.createBcotProduct(productInfo.amount, productInfo.sku);
                }
                catch (err) {
                    // Error trying to create new BCOT product. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to create new BCOT product.', util.inspect({productInfo: productInfo}), err);
                    throw new Meteor.Error('bcotProduct.create.failure', 'Failure trying to create new BCOT product: ' + err.toString());
                }
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        },
        deactivateBcotProduct: function (bcotProduct_id) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                try {
                    BcotProduct.getBcotProductByDocId(bcotProduct_id).deactivate();
                }
                catch (err) {
                    // Error trying to deactivate BCOT product. Log error and throw exception
                    Catenis.logger.ERROR('Failure trying to deactivate BCOT product (doc_id: %s).', bcotProduct_id, err);
                    throw new Meteor.Error('bcotProduct.deactivate.failure', 'Failure trying to deactivate BCOT product: ' + err.toString());
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
    Meteor.publish('bcotProducts', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.BcotProduct.find();
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('activeBcotProducts', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.BcotProduct.find({
                active: true
            });
        }
        else {
            // User not logged in or not a system administrator
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });

    Meteor.publish('bcotProductRecord', function (bcotProduct_id) {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            return Catenis.db.collection.BcotProduct.find({
                _id: bcotProduct_id
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


// BcotProductsUI function class (public) properties
//

/*BcotProductsUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BcotProductsUI);
