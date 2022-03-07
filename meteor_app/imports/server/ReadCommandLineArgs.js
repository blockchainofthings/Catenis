/**
 * Created by claudio on 2020-09-28
 */

//console.log('[ReadCommandLineArgs.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import Future from 'fibers/future';
import SocketInputParams from 'socket-input-params';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { Util } from './Util';


// Module code
//

if (!Meteor.isTest) {
    const sockInParams = new SocketInputParams({
        path: process.env.PWD,
        readTimeout: 30000,
        optionDefs: [{
            name: 'password',
            alias: 'p'
        }, {
            name: 'bypass-processing',
            alias: 'b',
            type: Boolean
        }, {
            name: 'cipher-data',
            alias: 'd',
            type: String,
            multiple: true
        }, {
            name: 'decipher-data',
            alias: 'D',
            type: String,
            multiple: true
        }, {
            name: 'no-cipher-probe',
            alias: 'o',
            type: Boolean,
            defaultValue: false
        }]
    });

    console.log('Waiting for input parameters...')

    const fut = new Future();

    sockInParams.getCommandLineOptions((err, result) => {
        if (err) {
            fut.throw(err);
        }
        else {
            fut.return(result);
        }
    });

    Catenis.cmdLineOpts = fut.wait();
}
else {
    // Running meteor app in test mode.
    //  Get command line options from environment variable
    let parsedCmdOpts;

    try {
        parsedCmdOpts = JSON.parse(process.env.CTN_TEST_CMDLN_OPTS);
    }
    catch (e) {}

    Catenis.cmdLineOpts = Util.isNonNullObject(parsedCmdOpts)
        ? parsedCmdOpts
        : {};
}
