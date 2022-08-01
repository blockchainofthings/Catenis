/**
 * Created by claudio on 2019-05-17.
 */

//console.log('[main.test.js]: This code just ran.');

// Load startup modules
import '/imports/server/ConfigEnv';
import '../imports/server/ReadCommandLineArgs';
import '../imports/server/SetUpCipherFunctions';
import '/imports/server/ConfigEmail';
import { Logger } from '../imports/server/Logger';
import { Database } from '../imports/server/Database';
import { Application } from '../imports/server/Application';

// Load test cases
import '/imports/server/test/FundSourceTest.js';
import '/imports/server/test/CCFundSourceTest.js';
import '/imports/server/test/NFTokenSourceTest.js';
import '/imports/server/test/NFTokenIssuingPartTest.js';
import '/imports/server/test/NFTokenIssuingBatchTest.js';
import '/imports/server/test/NFTokenContentsUrlTest.js';
import '/imports/server/test/NFAssetIssuanceTest.js';
import '/imports/server/test/NFTokenStorageTest.js';
import '/imports/server/test/NFTokenContentsReadableTest.js';
import '/imports/server/test/CCUserDataMetadataTest.js';
import '/imports/server/test/CCSingleNFTokenMetadataTest.js';
import '/imports/server/test/CCNFTokenMetadataTest.js';
import '/imports/server/test/CCAssetMetadataTest.js';
import '/imports/server/test/CCMetadataTest.js';
import '/imports/server/test/BufferProgressReadableTest.js';
import '/imports/server/test/RetrievedNFTokenDataTest.js';
import '/imports/server/test/NFTokenRetrievalTest.js';
import '/imports/server/test/NFTokenMetadataWritableTest.js';
import '/imports/server/test/NFTokenContentsWritableTest.js';
import '/imports/server/test/DataEncryptionTest.js';
import '/imports/server/test/DataDecryptionTest.js';


// Initialize required modules
Logger.initialize();
Database.initialize();
Application.initialize();
