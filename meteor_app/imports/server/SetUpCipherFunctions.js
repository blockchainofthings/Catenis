/**
 * Created by claudio on 2020-09-28
 */

//console.log('[SetUpCipherFunctions.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import crypto from "crypto";
// Third-party node modules
import config from 'config';
import CatenisCipher from 'catenis-cipher';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

const cipherProbe = config.get('setUpCipherFunctions.cipherProbe');


// Module code
//

try {
    if (!Catenis.cmdLineOpts.password) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error('No password specified');
    }

    const cipherFuncs = new CatenisCipher().genCipherFunctions(Catenis.cmdLineOpts.password);

    Catenis.cipherData = cipherFuncs.cipher;
    Catenis.decipherData = cipherFuncs.decipher;

    if (!Catenis.cmdLineOpts['no-cipher-probe']) {
        let plainTxtBuf;

        try {
            plainTxtBuf = Catenis.decipherData(cipherProbe.data);
        }
        catch (err) {
            if (err.code === 'ERR_OSSL_EVP_BAD_DECRYPT') {
                // noinspection ExceptionCaughtLocallyJS
                throw new Error('Error decrypting cipher probe data; please check your password');
            }

            // noinspection ExceptionCaughtLocallyJS
            throw err;
        }

        const hash = crypto.createHash('sha256');

        const computedHash = hash.update(plainTxtBuf).digest().toString('base64');

        if (computedHash !== cipherProbe.hash) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error('Cipher probe data mismatch');
        }
    }

    // Cipher functions successfully set up. Make sure that password is not out in the open
    Catenis.cmdLineOpts.cipheredPassword = Catenis.cipherData(Catenis.cmdLineOpts.password).toString('base64');
    delete Catenis.cmdLineOpts.password;
}
catch (err) {
    throw new Error('Error trying to set up cipher functions: ' + err.toString());
}

