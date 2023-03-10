/**
 * Created by Claudio on 2016-07-24.
 */

//console.log('[CriticalSection.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import Future from 'fibers/future';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

export class CriticalSection {
    constructor () {
        this.processing = false;
        this.waitingTasks = [];
    }

    // CAUTION: a code being execute from one critical section object MUST NOT
    //  execute another code from the same critical section object. In other words:
    //  CRITICAL SECTION EXECUTIONS MUST NOT BE NESTED.
    execute(code) {
        try {
            // Make sure code is executed in its own fiber, and wait until its execution ends
            Future.task(() => {
                if (this.processing) {
                    // Already doing processing. Wait for current executing
                    //  code to finish before proceeding
                    const fut = new Future();

                    this.waitingTasks.push(fut);

                    fut.wait();
                }
                else {
                    // No processing currently underway. Indicate that processing started,
                    //  and continue to execute code
                    this.processing = true;
                }

                code();
            }).wait();
        }
        finally {
            // Code has finished executing (either gracefully or with error).
            //  Check if there are other pieces of code waiting for execution
            if (this.waitingTasks.length > 0) {
                // Release next code in queue for execution
                this.waitingTasks.shift().return();
            }
            else {
                // No more code to execute. Just indicate that processing has ended
                this.processing = false;
            }
        }
    }
}