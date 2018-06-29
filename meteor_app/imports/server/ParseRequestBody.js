/**
 * Created by claudio on 13/02/17.
 */

//console.log('[ParseRequestBody.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import bodyParser from 'body-parser';
// Meteor packages
import { WebApp } from 'meteor/webapp';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { restApiRootPath } from './RestApi';


// Definition of function classes
//

// ParseRequestBody function class
function ParseRequestBody() {
}


// ParseRequestBody function class (public) methods
//

// Custom 'connect' middleware used to parse the body of a request to Catenis' REST API
//  as a JSON but still preserve the raw body contents which is required for authenticating
//  the request.
ParseRequestBody.parser = function (req, res, next) {
    ParseRequestBody.rawBody.parser = ParseRequestBody.rawBody.parser || bodyParser.raw({limit: '50mb', type: 'application/json'});

    // Get raw body
    ParseRequestBody.rawBody.parser(req, res, (err) => {
        if (err) {
            Catenis.logger.ERROR('Error parsing request body.', err);
            sendError(res, 'Error parsing request body');
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
                            sendError(res, 'Error parsing request body as JSON');
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


// Module code
//

// Add this as first middleware handler
WebApp.connectHandlers.stack.unshift({
    route: '/' + restApiRootPath,
    handle: ParseRequestBody.parser
});

// Lock function class
Object.freeze(ParseRequestBody);
