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
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';


// Module code
//

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
