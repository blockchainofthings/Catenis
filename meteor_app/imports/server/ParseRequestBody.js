/**
 * Created by Claudio on 2017-02-13.
 */

//console.log('[ParseRequestBody.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import zlib from 'zlib';
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
    reqBodySizeLimit: parseReqBodyConfig.get('reqBodySizeLimit')
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
    ParseRequestBody.rawBody.limit = ParseRequestBody.rawBody.limit || (cfgSettings.reqBodySizeLimit + 'mb');

    // NOTE: make sure that the 'body-parser' component does NOT decompress the request payload
    //      should it have a content encoding different and 'identity'. So set the 'inflate' option
    //      to false and reset the Content-Encoding header (otherwise an error is thrown)
    const bodyParserOpts = {
        limit: ParseRequestBody.rawBody.limit,
        type: 'application/json'
    };
    let contentEncoding ;

    if (req.headers['content-encoding'] !== undefined && (contentEncoding = req.headers['content-encoding'].toLowerCase()) !== 'identity') {
        bodyParserOpts.inflate = false;

        req.headers['content-encoding'] = 'identity';
    }

    ParseRequestBody.rawBody.parser = ParseRequestBody.rawBody.parser || bodyParser.raw(bodyParserOpts);

    // Get raw body
    ParseRequestBody.rawBody.parser(req, res, (err) => {
        if (err) {
            Catenis.logger.ERROR('Error parsing request body.', err);
            sendParsedError(req, res, err);
        }
        else {
            if (req._body) {
                // Save raw body (non-decompressed) and reset parsed body
                req.rawBody = req.body;

                // Check if body needs to be decompressed
                if (contentEncoding && contentEncoding !== 'identity') {
                    try {
                        // Decompress body
                        switch (contentEncoding) {
                            case 'deflate':
                                req.body = zlib.inflateSync(req.body);

                                break;

                            case 'gzip':
                                req.body = zlib.gunzipSync(req.body);

                                break;

                            default:
                                sendError(req, res, 'Unsupported content encoding', 415);
                                return;
                        }
                    }
                    catch (err) {
                        Catenis.logger.ERROR('Error decoding request body.', err);
                        sendError(req, res, 'Request body not properly encoded', 400);
                        return;
                    }
                }

                if (req.body.length > 0) {
                    // Parse raw body as JSON
                    try {
                        req.body = JSON.parse(req.body.toString());
                    }
                    catch (err) {
                        Catenis.logger.ERROR('Error parsing request body as JSON.', err);
                        if (err.name === 'SyntaxError') {
                            sendError(req, res, 'Request body is not a well-formed JSON', 400);
                        }
                        else {
                            sendError(req, res, 'Internal server error');
                        }

                        return;
                    }
                }
                else {
                    req.body = {};
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

function sendError(req, res, errMsg, statusCode) {
    res.statusCode = statusCode || 500;
    res.setHeader('Content-Type', 'application/json');

    addCorsResponseHeaders(req, res);

    res.end(JSON.stringify({
        status: 'error',
        message: errMsg
    }));
}

function sendParsedError(req, res, error) {
    if ((error instanceof Error) && (typeof error.status === 'number' || typeof error.statusCode === 'number')) {
        const statusCode = typeof error.status === 'number' ? error.status : error.statusCode;
        // Filter 413 (Payload too large) status code so a custom message is returned
        const errMsg = statusCode < 500 ? (statusCode === 413 ? 'Request data too large to be processed' : error.message) : 'Internal server error';

        return sendError(req, res, errMsg, statusCode);
    }
    else {
        return sendError(req, res, 'Internal server error');
    }
}

function addCorsResponseHeaders(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if ('origin' in req.headers) {
        res.setHeader('Access-Control-Allow-Origin', req.headers['origin']);
        res.setHeader('Vary', 'Origin');
    }
    else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'DNT, X-CustomHeader, Keep-Alive, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Accept, Origin, Content-Type, Content-Encoding, Accept-Encoding, X-Bcot-Timestamp, Authorization');
}


// Module code
//

// Add this as first middleware handler
WebApp.connectHandlers.use('/' + restApiRootPath, ParseRequestBody.parser);
WebApp.connectHandlers.stack.unshift(WebApp.connectHandlers.stack.pop());

// Lock function class
Object.freeze(ParseRequestBody);
