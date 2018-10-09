/**
 * Created by Claudio on 2017-08-17.
 */

//console.log('[Authentication.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import crypto from 'crypto';
// Third-party node modules
import config from 'config';
import moment from 'moment';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const authenticationConfig = config.get('authentication');
const httpReqSignConfig = authenticationConfig.get('httpRequestSignature');

// Configuration settings
const cfgSettings = {
    httpRequestSignature: {
        signVersionId: httpReqSignConfig.get('signVersionId'),
        signMethodId: httpReqSignConfig.get('signMethodId'),
        scopeRequest: httpReqSignConfig.get('scopeRequest'),
        timestampHdr: httpReqSignConfig.get('timestampHdr'),
        allowedTimestampOffset: httpReqSignConfig.get('allowedTimestampOffset'),
        authRegexPattern: httpReqSignConfig.get('authRegexPattern'),
        signValidDays: httpReqSignConfig.get('signValidDays')
    }
};

export const authHeader = 'authorization';
const authRegex = new RegExp(cfgSettings.httpRequestSignature.authRegexPattern.replace('<signMethodId>', cfgSettings.httpRequestSignature.signMethodId)
    .replace('<scopeRequest>', cfgSettings.httpRequestSignature.scopeRequest));

// Definition of function classes
//

// Authentication function class
export function Authentication() {
}


// Public Authentication object methods
//

/*Authentication.prototype.pub_func = function () {
};*/


// Module functions used to simulate private Authentication object methods
//  NOTE: these functions need to be bound to a Authentication object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Authentication function class (public) methods
//

// Parses HTTP request to retrieve authentication relevant data from it
//
//  Arguments:
//   req [Object] - HTTP request object
//
//  Return:
//   parsedInfo: {
//     timestamp: [String], - Timestamp of request
//     deviceId: [String], - Catenis ID of device that issued the request
//     signDate: [String] - Signature date
//     signature: [String] - Request's signature
//   }
Authentication.parseHttpRequest = function (req) {
    const dtNow = new Date(Date.now());

    // Make sure that required headers are present
    if (!(cfgSettings.httpRequestSignature.timestampHdr in req.headers) || !(authHeader in req.headers)) {
        // Missing required HTTP headers. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing HTTP request for authentication: missing required HTTP headers', req);
        throw new Meteor.Error('ctn_auth_parse_err_missing_headers', 'Error parsing HTTP request for authentication: missing required HTTP headers');
    }

    // Make sure that timestamp is valid
    const strTmstmp = req.headers[cfgSettings.httpRequestSignature.timestampHdr],
        tmstmp = moment(strTmstmp, 'YYYYMMDDTHHmmssZ', true),
        now = moment(dtNow).milliseconds(0);

    if (!tmstmp.isValid()) {
        // Timestamp not well formed. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing HTTP request for authentication: timestamp not well formed', req);
        throw new Meteor.Error('ctn_auth_parse_err_malformed_timestamp', 'Error parsing HTTP request for authentication: timestamp not well formed');
    }

    if (!tmstmp.isBetween(now.clone().subtract(cfgSettings.httpRequestSignature.allowedTimestampOffset, 'seconds'), now.clone().add(cfgSettings.httpRequestSignature.allowedTimestampOffset, 'seconds'), null, '[]')) {
        // Timestamp not within acceptable time variation. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing HTTP request for authentication: timestamp not within acceptable time variation', req);
        throw new Meteor.Error('ctn_auth_parse_err_timestamp_out_of_bounds', 'Error parsing HTTP request for authentication: timestamp not within acceptable time variation');
    }

    // Try to parse Authorization header
    let matchResult;

    if (!(matchResult = req.headers[authHeader].match(authRegex))) {
        // HTTP Authorization header value not well formed. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing HTTP request for authentication: authorization value not well formed', req);
        throw new Meteor.Error('ctn_auth_parse_err_malformed_auth_header', 'Error parsing HTTP request for authentication: authorization value not well formed');
    }

    const deviceId = matchResult[1],
        strSignDate = matchResult[2],
        signature = matchResult[3];

    // Make sure that date of signature is valid
    const signDate = moment.utc(strSignDate, 'YYYYMMDD', true);

    if (!signDate.isValid()) {
        // Signature date not well formed. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing HTTP request for authentication: signature date not well formed', req);
        throw new Meteor.Error('ctn_auth_parse_err_malformed_sign_date', 'Error parsing HTTP request for authentication: signature date not well formed');
    }

    if (!now.clone().utc().isBetween(signDate, signDate.clone().add(cfgSettings.httpRequestSignature.signValidDays, 'days'), 'day', '[)')) {
        // Signature date out of bounds. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing HTTP request for authentication: signature date out of bounds', req);
        throw new Meteor.Error('ctn_auth_parse_err_sign_date_out_of_bounds', 'Error parsing HTTP request for authentication: signature date out of bounds');
    }
    
    // Return parsed data
    return {
        timestamp: strTmstmp,
        deviceId: deviceId,
        signDate: strSignDate,
        signature: signature
    }
};

// Sign HTTP request
//
// Arguments:
//  info: {
//    timestamp: [string], - Timestamp of request
//    signDate: [string], - Signature date
//    apiAccessSecret: [string] - API access secret of device that issued the request
//  }
//
// Return:
//  signature [String] - request's computed signature
Authentication.signHttpRequest = function (req, info) {
    //Catenis.logger.DEBUG('>>>>>> Sign date: ' + info.signDate);
    // First step: compute conformed request
    let confReq = req.method + '\n';
    confReq += req.url + '\n';

    let essentialHeaders = 'host:' + req.headers.host + '\n';

    if (cfgSettings.httpRequestSignature.timestampHdr in req.headers) {
        essentialHeaders += cfgSettings.httpRequestSignature.timestampHdr + ':' + req.headers[cfgSettings.httpRequestSignature.timestampHdr] + '\n';
    }

    confReq += essentialHeaders + '\n';
    confReq += hashData(req.rawBody) + '\n';
    //Catenis.logger.DEBUG('>>>>>> Conformed request: ' + confReq);

    // Second step: assemble string to sign
    let strToSign = cfgSettings.httpRequestSignature.signMethodId +'\n';
    strToSign += info.timestamp + '\n';

    const scope = info.signDate + '/' + cfgSettings.httpRequestSignature.scopeRequest;

    strToSign += scope + '\n';
    strToSign += hashData(confReq) + '\n';
    //Catenis.logger.DEBUG('>>>>>> String to sign: ' + strToSign);

    // Third step: generate the signature
    const dateKey = signData(info.signDate, cfgSettings.httpRequestSignature.signVersionId + info.apiAccessSecret),
        signKey = signData(cfgSettings.httpRequestSignature.scopeRequest, dateKey);
    //Catenis.logger.DEBUG('>>>>>> Date key (hex): ' + dateKey.toString('hex'));
    //Catenis.logger.DEBUG('>>>>>> Sign key (hex): ' + signKey.toString('hex'));

    //return signData(strToSign, signKey, true);
    // noinspection UnnecessaryLocalVariableJS
    const signature = signData(strToSign, signKey, true);
    //Catenis.logger.DEBUG('>>>>>> Request signature: ' + signature);
    return signature;
};

// NOTE: this method is only provided for debugging purpose
Authentication.genReqSignature = function (apiAccessSecret, timestamp, signDate, host = 'sandbox.catenis.io', method = 'GET', url = '/api/0.3/messages/mdQP57eQjwmsciBwTssw?encoding=utf8', rawBody = Buffer.from('')) {
    if (signDate === undefined) {
        signDate = moment(timestamp).utc().format('YYYYMMDD');
    }

    const request = {
        method: method,
        url: url,
        headers: {
            host: host,
            'x-bcot-timestamp': timestamp
        },
        rawBody: rawBody
    };

    const info = {
        timestamp: timestamp,
        signDate: signDate,
        apiAccessSecret: apiAccessSecret
    };

    return Authentication.signHttpRequest(request, info);
};


// Authentication function class (public) properties
//

/*Authentication.prop = {};*/


// Definition of module (private) functions
//

function hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function signData(data, secret, hexEncode = false) {
    return crypto.createHmac('sha256', secret).update(data).digest(hexEncode ? 'hex' : undefined);
}


// Module code
//

// Definition of properties
Object.defineProperties(Authentication, {
    timestampHeader: {
        get: function () {
            return cfgSettings.httpRequestSignature.timestampHdr;
        },
        enumerable: true
    }
});

// Lock function class
Object.freeze(Authentication);
