/**
 * Created by claudio on 2019-05-17.
 */

//console.log('[main.test.js]: This code just ran.');

// Load startup modules
import '/imports/server/ConfigEnv';
import '/imports/server/ConfigEmail';
import { Logger } from '../imports/server/Logger';
import { Database } from '../imports/server/Database';
import { Application } from '../imports/server/Application';

// Load test cases
import '/imports/server/test/FundSourceTest.js';

// Initialize required modules
Logger.initialize();
Database.initialize();
Application.initialize();
