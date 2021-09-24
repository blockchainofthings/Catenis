/**
 * Created by claudio on 2021-09-24
 */

//console.log('[ConfigMeteorSettings.js]: This code just ran.');

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


// Module code
//

// Configure public Catenis settings
Meteor.settings.public.catenis = {
    ...Meteor.settings.public.catenis,
    ...{
        enableSelfRegistration: config.get('application.enableSelfRegistration')
    }
};