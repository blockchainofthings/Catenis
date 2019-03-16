/**
 * Created by Claudio on 2017-02-13.
 */

//console.log('[ParseRequestBody.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import config from 'config';
import bodyParser from 'body-parser';
// Meteor packages
import { WebApp } from 'meteor/webapp';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { restApiRootPath } from './RestApi';

// Config entries
const parseReqBodyConfig = config.get('parseRequestBody');

// Configuration settings
const cfgSettings = {
    maxFileSizeMB: parseReqBodyConfig.get('maxFileSizeMB'),
    fileHeaderSize: parseReqBodyConfig.get('fileHeaderSize'),
    msgApiMethodOverhead: parseReqBodyConfig.get('msgApiMethodOverhead'),
    bodySizeLimitSafetyFactor: parseReqBodyConfig.get('bodySizeLimitSafetyFactor')
};


// Definition of function classes
//

// ParseRequestBody function class
export function ParseRequestBody() {
}


// ParseRequestBody function class (public) methods
//

// Custom 'connect' middleware used to parse the body of a request to Catenis' REST API
//  as a JSON but still preserve the raw body contents which is required for authenticating
//  the request.
ParseRequestBody.parser = function (req, res, next) {
    ParseRequestBody.rawBody.limit = ParseRequestBody.rawBody.limit || calculateBodySizeLimit();
    ParseRequestBody.rawBody.parser = ParseRequestBody.rawBody.parser || bodyParser.raw({limit: ParseRequestBody.rawBody.limit, type: 'application/json'});

    // Get raw body
    ParseRequestBody.rawBody.parser(req, res, (err) => {
        if (err) {
            Catenis.logger.ERROR('Error parsing request body.', err);
            sendParsedError(res, err);
        }
        else {
            if (req._body) {
                // Save raw body and reset parsed body
                req.rawBody = req.body;
                req.body = {};

                if (req.rawBody.length > 0) {
                    // Parse raw body as JSON
                    try {
                        req.body = JSON.parse(req.rawBody.toString());
                    }
                    catch (err) {
                        Catenis.logger.ERROR('Error parsing request body as JSON.', err);
                        if (err.name === 'SyntaxError') {
                            sendError(res, 'Request body is not a well-formed JSON', 400);
                        }
                        else {
                            sendError(res, 'Internal server error');
                        }
                        return;
                    }
                }
            }
            else {
                // Assume that request has no payload
                req.rawBody = Buffer.from('');
            }

            next();
        }
    });
};


// ParseRequestBody function class (public) properties
//

ParseRequestBody.rawBody = {
    limit: undefined,
    parser: undefined
};


// Definition of module (private) functions
//

function sendError(res, errMsg, statusCode) {
    res.statusCode = statusCode || 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        status: 'error',
        message: errMsg
    }));
}

function sendParsedError(res, error) {
    if ((error instanceof Error) && (typeof error.status === 'number' || typeof error.statusCode === 'number')) {
        const statusCode = typeof error.status === 'number' ? error.status : error.statusCode;
        // Filter 413 (Request entity too large) status code so a custom message is returned
        const errMsg = statusCode < 500 ? (statusCode === 413 ? 'Request data too large to be processed' : error.message) : 'Internal server error';

        return sendError(res, errMsg, statusCode);
    }
    else {
        return sendError(res, 'Internal server error');
    }
}

function calculateBodySizeLimit() {
    let extraBytes = cfgSettings.fileHeaderSize + cfgSettings.msgApiMethodOverhead;

    // Round it up to next power of 2
    extraBytes = Math.pow(2, Math.ceil(Math.log(extraBytes) / Math.log(2)));

    let lenFileContents = cfgSettings.maxFileSizeMB * 1024 * 1024;

    // Calculate final file contents length when using base-64 encoding
    lenFileContents = Math.ceil((lenFileContents / 3) * 4);

    // Calculate total size in MB
    const totalMBytes = Math.ceil((lenFileContents + extraBytes) / (1024 * 1024));

    // Apply safety factor and return size limit
    return Math.ceil(totalMBytes * (1 + cfgSettings.bodySizeLimitSafetyFactor)) + 'mb';
}


// Module code
//

// Add this as first middleware handler
WebApp.connectHandlers.stack.unshift({
    route: '/' + restApiRootPath,
    handle: ParseRequestBody.parser
});

// Lock function class
Object.freeze(ParseRequestBody);
