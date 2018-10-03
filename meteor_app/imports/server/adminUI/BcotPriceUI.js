/**
 * Created by claudio on 2016-07-09.
 */

//console.log('[BcotPriceUI.js]: This code just ran.');

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
import { BcotPrice } from '../BcotPrice';

// Definition of function classes
//

// BcotPriceUI function class
export function BcotPriceUI() {
}


// Public BcotPriceUI object methods
//

/*BcotPriceUI.prototype.pub_func = function () {
};*/


// Module functions used to simulate private BcotPriceUI object methods
//  NOTE: these functions need to be bound to a BcotPriceUI object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// BcotPriceUI function class (public) methods
//

BcotPriceUI.initialize = function () {
    Catenis.logger.TRACE('BcotPriceUI initialization');
    // Declaration of RPC methods to be called from client
    Meteor.methods({
        setBcotPrice: function (price) {
            if (Roles.userIsInRole(this.userId, 'sys-admin')) {
                Catenis.bcotPrice.setNewBcotPrice(price);
            }
            else {
                // User not logged in or not a system administrator.
                //  Throw exception
                throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
            }
        }
    });

    // Declaration of publications
    Meteor.publish('bcotPrice', function () {
        if (Roles.userIsInRole(this.userId, 'sys-admin')) {
            let currBcotPrice = Catenis.bcotPrice.getCurrentBcotPrice();

            // Set initial BCOT token price
            this.added('BcotTokenPrice', 1, {
                price: currBcotPrice,
            });
            this.ready();

            const newBcotPriceHandler = (price) => {
                if (price !== currBcotPrice) {
                    currBcotPrice = price;

                    this.changed('BcotTokenPrice', 1, {
                        price: currBcotPrice
                    });
                }
            };

            // Set up handler to receive notification when a new BCOT token price is set
            Catenis.bcotPrice.on(BcotPrice.notifyEvent.new_bcot_price.name, newBcotPriceHandler);

            this.onStop(() => {
                Catenis.bcotPrice.removeListener(BcotPrice.notifyEvent.new_bcot_price.name, newBcotPriceHandler);
            });
        }
        else {
            // User not logged in or not a system administrator.
            //  Make sure that publication is not started and throw exception
            this.stop();
            throw new Meteor.Error('ctn_admin_no_permission', 'No permission; must be logged in as a system administrator to perform this task');
        }
    });
};


// BcotPriceUI function class (public) properties
//

/*BcotPriceUI.prop = {};*/


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(BcotPriceUI);
