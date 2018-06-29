/**
 * Created by Claudio on 2016-07-24.
 */

// References to external code
//
// Internal node modules
import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from '../Catenis';
import { CriticalSection } from '../CriticalSection.js';

// Instantiate critical section object
const tstCS = new CriticalSection();

let hd;

export function TestCriticalSection () {
}

TestCriticalSection.initTest = function () {
    console.log('Set interval');
    hd = Meteor.setInterval(readDBTest, 100);
    /*try {
        tstCS.execute(() => {
            readDBTest();
        });
    }
    catch (err) {
        console.log('!!!!!! Error caught: ', err);
    }*/
    readDBTest('TEST', 1000);
    TestCriticalSection.stopTest();
};

TestCriticalSection.stopTest = function () {
    if (hd) {
        console.log('Clear interval');
        Meteor.clearInterval(hd);
        hd = undefined;
    }
};

function readDBTest(id = 'INTERVAL', iterations = 1) {
    tstCS.execute(() => {
        for (let count = 1; count <= iterations; count++) {
            console.log(util.format('Reading DB [%s] (count %d)', id, count));
            Catenis.db.collection.IssuedBlockchainAddress.find({}).fetch();
            /*if (count == 500) {
                //throw Error('Test exception');
                try {
                    // ERROR! This will yield a deadlock situation (since this function (readDBTest)
                    //  is being executed from the same critical section object
                    tstCS.execute(() => {
                        readMoreDB();
                    });
                }
                catch (err) {
                    console.log('!!!!!! Error caught (readMoreDB): ', err);
                }
            }*/
        }
    });
}

function readMoreDB() {
    console.log('&&&&&& Reading DB (readMoreDB)');
    Catenis.db.collection.IssuedBlockchainAddress.find({}).fetch();
}

function intervalTask() {
    console.log('>>>>>> intervalTask()');
    tstCS.execute(() => {
        console.log('****** Reading DB (intervalTask)');
        Catenis.db.collection.IssuedBlockchainAddress.find({});
    });
}

// Lock function class
Object.freeze(TestCriticalSection);
