/**
 * Created by claudio on 2017-01-27.
 */

// Load startup modules
import '/imports/server/ConfigEnv';
import '../imports/server/ReadCommandLineArgs';
import '../imports/server/SetUpCipherFunctions';
import '/imports/server/ConfigEmail';
import { Logger } from '../imports/server/Logger';
Logger.initialize();
import '/imports/both/ConfigAccounts';
import '/imports/server/ConfigAccountsServer';
import '/imports/server/Startup';
