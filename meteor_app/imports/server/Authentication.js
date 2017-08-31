/**
 * Created by claudio on 17/08/17.
 */

//console.log('[Authentication.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done using 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const crypto = require('crypto');
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
        signValidDays: httpReqSignConfig.get('signValidDays'),
        wsAuthUsernameRegexPattern: httpReqSignConfig.get('wsAuthUsernameRegexPattern'),
        wsAuthPasswordRegexPattern: httpReqSignConfig.get('wsAuthPasswordRegexPattern')
    }
};

const authRegex = new RegExp(cfgSettings.httpRequestSignature.authRegexPattern.replace('<signMethodId>', cfgSettings.httpRequestSignature.signMethodId)
    .replace('<scopeRequest>', cfgSettings.httpRequestSignature.scopeRequest));
const wsAuthUsernameRegex = new RegExp(cfgSettings.httpRequestSignature.wsAuthUsernameRegexPattern.replace('<scopeRequest>', cfgSettings.httpRequestSignature.scopeRequest));
const wsAuthPasswordRegex = new RegExp(cfgSettings.httpRequestSignature.wsAuthPasswordRegexPattern);

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
    if (!(cfgSettings.httpRequestSignature.timestampHdr in req.headers) || !('authorization' in req.headers)) {
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

    if (!(matchResult = req.headers.authorization.match(authRegex))) {
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

// Parses WebSocket HTTP request to retrieve authentication relevant data from it
//
//  Arguments:
//   req [Object] - WebSocket HTTP request object
//
//  Return:
//   parsedInfo: {
//     timestamp: [String], - Timestamp of request
//     deviceId: [String], - Catenis ID of device that issued the request
//     signDate: [String] - Signature date
//     signature: [String] - Request's signature
//   }
Authentication.parseWsHttpRequest = function (req) {
    const dtNow = new Date(Date.now());

    // Make sure that required headers are present
    if (!('authorization' in req.headers)) {
        // Missing required HTTP headers. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing WebSocket HTTP request for authentication: missing required HTTP headers', req);
        throw new Meteor.Error('ctn_auth_parse_err_missing_headers', 'Error parsing WebSocket HTTP request for authentication: missing required HTTP headers');
    }

    // Parse Authorization header
    const credentials = parseBasicAuthAuthorizationHeader(req.headers.authorization);

    if (credentials === undefined) {
        // HTTP Authorization header value not well formed. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing WebSocket HTTP request for authentication: authorization value not well formed', req);
        throw new Meteor.Error('ctn_auth_parse_err_malformed_auth_header', 'Error parsing WebSocket HTTP request for authentication: authorization value not well formed');
    }

    // Parse Authorization header credentials
    const usrMatchResult = credentials.username.match(wsAuthUsernameRegex);
    const pswMatchResult = credentials.password.match(wsAuthPasswordRegex);

    if (usrMatchResult === null || pswMatchResult === null) {
        // Credentials in HTTP Authorization header not well formed. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing WebSocket HTTP request for authentication: authorization credentials value not well formed', req);
        throw new Meteor.Error('ctn_auth_parse_err_malformed_auth_credentials', 'Error parsing WebSocket HTTP request for authentication: authorization credentials value not well formed');
    }

    const deviceId = usrMatchResult[1],
        strSignDate = usrMatchResult[2],
        strTmstmp = usrMatchResult[3],
        signature = pswMatchResult[0];

    // Make sure that timestamp is valid
    const tmstmp = moment(strTmstmp, 'YYYYMMDDTHHmmssZ', true),
        now = moment(dtNow).milliseconds(0);

    if (!tmstmp.isValid()) {
        // Timestamp not well formed. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing WebSocket HTTP request for authentication: timestamp not well formed', req);
        throw new Meteor.Error('ctn_auth_parse_err_malformed_timestamp', 'Error parsing WebSocket HTTP request for authentication: timestamp not well formed');
    }

    if (!tmstmp.isBetween(now.clone().subtract(cfgSettings.httpRequestSignature.allowedTimestampOffset, 'seconds'), now.clone().add(cfgSettings.httpRequestSignature.allowedTimestampOffset, 'seconds'), null, '[]')) {
        // Timestamp not within acceptable time variation. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing WebSocket HTTP request for authentication: timestamp not within acceptable time variation', req);
        throw new Meteor.Error('ctn_auth_parse_err_timestamp_out_of_bounds', 'Error parsing WebSocket HTTP request for authentication: timestamp not within acceptable time variation');
    }

    // Make sure that date of signature is valid
    const signDate = moment.utc(strSignDate, 'YYYYMMDD', true);

    if (!signDate.isValid()) {
        // Signature date not well formed. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing WebSocket HTTP request for authentication: signature date not well formed', req);
        throw new Meteor.Error('ctn_auth_parse_err_malformed_sign_date', 'Error parsing WebSocket HTTP request for authentication: signature date not well formed');
    }

    if (!now.clone().utc().isBetween(signDate, signDate.clone().add(cfgSettings.httpRequestSignature.signValidDays, 'days'), 'day', '[)')) {
        // Signature date out of bounds. Log error and throw exception
        Catenis.logger.DEBUG('Error parsing WebSocket HTTP request for authentication: signature date out of bounds', req);
        throw new Meteor.Error('ctn_auth_parse_err_sign_date_out_of_bounds', 'Error parsing WebSocket HTTP request for authentication: signature date out of bounds');
    }

    // Return parsed data
    return {
        timestamp: strTmstmp,
        deviceId: deviceId,
        signDate: strSignDate,
        signature: signature
    }
};


// NOTE: this method is only provided for debugging purpose
Authentication.genReqSignature = function (apiAccessSecret, timestamp, signDate, host = 'beta.catenis.io', method = 'GET', url = '/api/0.3/messages/mdQP57eQjwmsciBwTssw?encoding=utf8', rawBody = new Buffer('')) {
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

// Parse HTTP Authorization header for basic authentication
//
//  Arguments:
//   authHeader [String] - HTTP request Authorization header value
//
//  Return:
//   credentials: {
//     username: [String], - Username part of credentials found in Authorization header value
//     password: [String]  - Password part of credentials found in Authorization header value
//   }
function parseBasicAuthAuthorizationHeader(authHeader) {
    try {
        const matchResult = authHeader.match(/^Basic +([A-Za-z0-9+/=]+)$/);

        if (matchResult !== null) {
            // Decode credentials
            const strCredentials = new Buffer(matchResult[1], 'base64').toString();

            const credMatchResult = strCredentials.match(/^([^:]*):([^:]*)$/);

            if (credMatchResult !== null) {
                // Authorization header successfully parsed. Return parsed credentials
                return {
                    username: decodeURIComponent(credMatchResult[1]),
                    password: decodeURIComponent(credMatchResult[2])
                }
            }
        }
    }
    catch(err) {
        // Error parsing HTTP Authorization header for basic authentication
        Catenis.logger.DEBUG('Error parsing HTTP Authorization header for basic authentication.', err);
    }
}


// Module code
//

// Lock function class
Object.freeze(Authentication);
