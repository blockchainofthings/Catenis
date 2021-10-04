/**
 * Created by claudio on 2021-09-22
 */

//console.log('[AccountRegistration.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Client } from './Client';
import { License } from './License';
import { UserRoles } from '../both/UserRoles';
import { SelfRegistrationBcotSale } from './SelfRegistrationBcotSale';
import { StandbyPurchasedBcot } from './StandbyPurchasedBcot';

// Config entries
const accRegConfig = config.get('accountRegistration');

// Configuration settings
const cfgSettings = {
    clientName: accRegConfig.get('clientName'),
    license: {
        level: accRegConfig.get('license.level'),
        type: accRegConfig.get('license.type'),
        revision: accRegConfig.get('license.revision')
    }
};


// Definition of classes
//

/**
 * AccountRegistration class
 */
export class AccountRegistration {
    // Class (public) methods
    //

    /**
     * Mark user as a self-registered user
     * @param {string} user_id Doc/rec ID of user
     */
    static setSelfRegisteredUser(user_id) {
        try {
            // Make sure that user ID is valid
            const user = Meteor.users.findOne({_id: user_id});

            if (!user) {
                // noinspection ExceptionCaughtLocallyJS
                throw new Error(`Invalid user ID: ${user_id}`);
            }

            // Add user to self-registered role
            Roles.addUsersToRoles(user_id, UserRoles.selfRegistered);
        }
        catch (err) {
            // Log error
            Catenis.logger.ERROR('Error trying to set self-registered user.', err);
        }
    }

    /**
     * Create a new client account for a previously registered user
     * @param {string} user_id Doc/rec ID of user to be assigned to new client
     */
    static newClient(user_id) {
        try {
            // Prepare user to be assigned to client
            const retInfo = Client.fixUserForClient(user_id, cfgSettings.clientName);

            // Get client license to be used
            const license = License.getLicense(
                cfgSettings.license.level,
                cfgSettings.license.type,
                cfgSettings.license.revision
            );

            // Prepare to create new Catenis client
            const props = {
                name: retInfo.clientName
            };

            if (retInfo.oldProfile.first_name) {
                props.firstName = retInfo.oldProfile.first_name;
            }

            if (retInfo.oldProfile.last_name) {
                props.lastName = retInfo.oldProfile.last_name;
            }

            if (retInfo.oldProfile.company) {
                props.company = retInfo.oldProfile.company;
            }

            if (retInfo.oldProfile.phone) {
                props.phone = retInfo.oldProfile.phone;
            }

            // Create Catenis client
            const clientId = Catenis.ctnHubNode.createClient(props, user_id, {
                timeZone: retInfo.oldProfile.time_zone
            });

            // Retrieve newly created client and add license to it
            const client = Client.getClientByClientId(clientId);

            client.addLicense(license.doc_id, new Date());

            // Add Catenis credits to client account
            try {
                addCatenisCredits(client);
            }
            catch (err) {
                // Log error
                Catenis.logger.ERROR('Error adding Catenis credits to self-registered client account (clientId: %s).', client.clientId, err)
            }

            // Send notification e-mail reporting that client account has been created
            Catenis.accRegistrationEmailNtfy.sendAsync(client, (error) => {
                if (error) {
                    // Error sending notification e-mail. Log error condition
                    Catenis.logger.ERROR(`Error sending notification e-mail reporting that a new client account (clientId: ${client.clientId}) has been created.`, error);
                }
            });

            // Send customer data to CRM system
            Catenis.crmIntegration.sendDataAsync(client, (error) => {
                if (error) {
                    // Error sending data. Log error condition
                    Catenis.logger.ERROR(`Error sending customer data (clientId: ${client.clientId}) to CRM system.`, error);
                }
            })
        }
        catch (err) {
            // Log error
            Catenis.logger.ERROR(`Error trying to create a new client account for a previously registered user (doc_id: ${user_id}).`, err);
            throw new Meteor.Error('ctn_acc_reg_new_client_error', 'Error trying to create a new client account for a previously registered user');
        }
    }
}


// Definition of module (private) functions
//

/**
 * Add Catenis credits to self-registered client account
 * @param {Client} client Catenis client object
 */
function addCatenisCredits(client) {
    const selfRegBcotSaleItem = SelfRegistrationBcotSale.getNextAvailableItem();
    let standbyBcot;

    try {
        standbyBcot = new StandbyPurchasedBcot(client);
        standbyBcot.addPurchasedCodes(selfRegBcotSaleItem.purchaseCode);
    }
    catch (err) {
        // Error assigning self-registration BCOT product to client for future processing.
        //  Free reserved self-registration BCOT sale item and rethrow error
        selfRegBcotSaleItem.free();
        throw err;
    }

    selfRegBcotSaleItem.setAsUsed();

    Meteor.defer(() => {
        try {
            standbyBcot.processBatches();
        }
        catch (err) {
            Catenis.logger.ERROR('Error redeeming self-registration assigned Catenis credits on standby for client (clientId: %s).', client.clientId, err);
        }
    });
}


// Module code
//

// Lock class
Object.freeze(AccountRegistration);
