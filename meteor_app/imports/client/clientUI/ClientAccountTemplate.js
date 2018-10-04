/**
 * Created by Claudio on 2018-10-3.
 */

//console.log('[ClientAccountTemplate.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import ClipboardJS from 'clipboard';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';
import { ClientUtil } from '../ClientUtil';

// Import template UI
import './ClientAccountTemplate.html';

// Import dependent templates


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

Template.clientAccount.onCreated(function () {
    this.state = new ReactiveDict();

    // Subscribe to receive database docs/recs updates
    this.loggedInClientSubs = this.subscribe('loggedInClient');
});

Template.clientAccount.onDestroyed(function () {
    if (this.loggedInClientSubs) {
        this.loggedInClientSubs.stop();
    }
});

Template.clientAccount.events({
});

Template.clientAccount.helpers({
    client() {
        return Catenis.db.collection.Client.findOne();
    },
    clientUsername(user_id) {
        const user = Meteor.users.findOne({_id: user_id});

        return user ? user.username : undefined;
    },
    clientContactName(client) {
        let contactName = client.props.firstName;

        if (client.props.lastName) {
            if (contactName) {
                contactName += ' ';
            }

            contactName += client.props.lastName;
        }

        return contactName;
    },
    clientUserEmail(user_id) {
        const user = Meteor.users.findOne({_id: user_id});

        return ClientUtil.getUserEmail(user);
    }
});
