/**
 * Created by claudio on 2020-07-16
 */

//console.log('[ReCaptcha.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
// Meteor packages
import { HTTP } from 'meteor/http';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const reCaptchaConfig = config.get('reCaptcha');

// Configuration settings
const cfgSettings = {
    verifyUrl: reCaptchaConfig.get('verifyUrl'),
    siteKey: reCaptchaConfig.get('siteKey'),
    secretKey: reCaptchaConfig.get('secretKey'),
    useForLogin: reCaptchaConfig.get('useForLogin')
};


// Definition of classes
//

// ReCaptcha class
export class ReCaptcha {
    // Constructor
    //

    /**
     * Class constructor
     * @param {String} verifyUrl Google reCAPTCHA verify Web service URL
     * @param {String} siteKey (Public) Site key of the Google reCAPTCHA account in use
     * @param {String} secretKey Secret key of the Google reCAPTCHA account in use
     */
    constructor(verifyUrl, siteKey, secretKey) {
        this.verifyUrl = verifyUrl;
        this.siteKey = siteKey;
        this.secretKey = secretKey;
    }


    // Public object properties (getters/setters)
    //

    get useForLogin() {
        return cfgSettings.useForLogin;
    }


    // Public object methods
    //

    /**
     * Method used to verify a Google reCAPTCHA response
     * @param {String} resToken The reCAPTCHA response token
     * @param {String} [clientIP] The client IP address
     */
    verify(resToken, clientIP) {
        const params = {
            secret: this.secretKey,
            response: resToken
        };

        if (clientIP) {
            params.remoteip = clientIP;
        }

        let postResponse;

        try {
            postResponse = HTTP.post(this.verifyUrl, {params});
        }
        catch (err) {
            //  Log error condition and throw exception
            if (err.response) {
                // Error response from Google reCAPTCHA verify Web service
                Catenis.logger.ERROR('Error response from Google reCAPTCHA verify Web service.', err);
            }
            else {
                // Error when sending request to Google reCAPTCHA verify Web service
                Catenis.logger.ERROR('Error when sending request to Google reCAPTCHA verify Web service.', err);
            }

            throw err;
        }

        const result = postResponse.data;

        if (!result.success && result['error-codes']) {
            // Google reCAPTCHA verification failed
            Catenis.logger.ERROR('Google reCAPTCHA verification failed', {'error-codes': result['error-codes']});
        }

        return result;
    }


    // Class (public) methods
    //

    static initialize() {
        Catenis.logger.TRACE('ReCaptcha initialization');
        Catenis.reCaptcha = new ReCaptcha(cfgSettings.verifyUrl, cfgSettings.siteKey, cfgSettings.secretKey);
    }
}


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock class
Object.freeze(ReCaptcha);
