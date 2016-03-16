/**
 * Created by claudio on 26/11/15.
 */

// NOTE: the name of this javascript source code module purposefully
//  starts with a question-mark character so it is guaranteed that
//  this piece of code will be loaded before any other server code
//console.log('[!Logging.js]: This code just ran.');

// Fix default config file folder.
//  Note: this is necessary because process.cwd()
//  (which is used by the config module to define the
//  default config folder) does not point to the
//  Meteor application folder. Instead, the application
//  folder is gotten from process.env.PWD and set
//  to the environment variable NODE_CONFIG_DIR,
//  which is used by the config module to set the
//  default config folder if it is defined.
if (process.env.NODE_CONFIG_DIR === undefined) {
    process.env.NODE_CONFIG_DIR = Npm.require('path').join(process.env.PWD, 'config');
}

// References to external moudules
Npm.require('babel-polyfill');  // Add ECMAScript-2015 (ES6) features to objects globally
var config = Npm.require('config');
var path = Npm.require('path');
var winston = Npm.require('winston');
var winstonTransportsDailyRotateFile = Npm.require('winston-daily-rotate-file');
var winstonTransportMail = Npm.require('winston-mail').Mail;
var util = Npm.require('util');

// Config variables
var loggingConfig = config.get('logging'),
    logConsoleConfig = loggingConfig.get('console'),
    logFileConfig = loggingConfig.get('file'),
    logEmailConfig = loggingConfig.get('email');


// Module code
//

// Definition of logging levels based on Log4J
var log4jLevels = {
    FATAL: 0,
    ERROR: 100,
    ACTION: 150,
    WARN: 200,
    INFO: 300,
    DEBUG: 400,
    TRACE: 500,
    ALL: 9999
};
var log4jColors = {
    FATAL: 'magenta',
    ERROR: 'red',
    ACTION: 'cyan',
    WARN: 'yellow',
    INFO: 'blue',
    DEBUG: 'green',
    TRACE: 'gray',
    ALL: 'gray'
};

// Valid e-mail secure protocols with their respective default ports
var emailSecureProtocols = {
    ssl: 465,
    tls: 587
}

// Config variables
var consoleLogActive = logConsoleConfig.get('active'),
    consoleLogLevel = logConsoleConfig.has('logLevel') && (logConsoleConfig.get('logLevel') in log4jLevels) ? logConsoleConfig.get('logLevel') : 'INFO',
    fileLogActive = logFileConfig.get('active'),
    fileLogLevel = logFileConfig.has('logLevel') && (logFileConfig.get('logLevel') in log4jLevels) ? logFileConfig.get('logLevel') : 'ALL',
    logDir = logFileConfig.get('logDir'),
    logFilename = logFileConfig.get('logFilename'),
    emailLogActive = logEmailConfig.get('active'),
    emailLogLevel = logEmailConfig.has('logLevel') && (logEmailConfig.get('logLevel') in log4jLevels) ? logEmailConfig.get('logLevel') : 'WARN',
    smtpHost = logEmailConfig.get('smtpHost'),
    emailSecureProto = logEmailConfig.has('secureProto') && (logEmailConfig.get('secureProto') in emailSecureProtocols) ? logEmailConfig.get('secureProto') : undefined,
    smtpPort = logEmailConfig.has('smtpPort') ? logEmailConfig.get('smtpPort') : undefined,
    emailUsername = logEmailConfig.has('username') ? logEmailConfig.get('username') : undefined,
    emailPassword = logEmailConfig.has('password') ? logEmailConfig.get('password') : undefined,
    emailToAddresses = logEmailConfig.get('toAddresses'),
    emailFromAddress = logEmailConfig.get('fromAddress'),
    emailSubject = logEmailConfig.get('subject');

// Definition of parameters for each different logging output (transport)
var consoleTranspParams = {
        level: consoleLogLevel,
        silent: !consoleLogActive,
        colorize: true,
        handleExceptions: true,
        exceptionsLevel: 'FATAL',
        humanReadableUnhandledException: true,
        timestamp: true,
        debugStdout: true,
        prettyPrint: true
    },
    fileTranspParams = {
        level: fileLogLevel,
        silent: !fileLogActive,
        colorize: false,
        handleExceptions: true,
        exceptionsLevel: 'FATAL',
        humanReadableUnhandledException: true,
        filename: path.join(process.env.PWD, logDir, logFilename),
        json: false,
        prettyPrint: true
    },
    emailTranspParams = {
        level: emailLogLevel,
        silent: !emailLogActive,
        host: smtpHost,
        to: emailToAddresses,
        from: emailFromAddress,
        subject: emailSubject,
        html: false,
        handleExceptions: true,
        exceptionsLevel: 'FATAL',
        humanReadableUnhandledException: true,
        prettyPrint: true
    };

// Complement logging transport parameters
if (emailSecureProto != undefined) {
    if (emailSecureProto === 'ssl') {
        emailTranspParams.ssl = true;
    }
    else if (emailTranspParams === 'tls') {
        emailTranspParams.tls = true;
    }
}

if (smtpPort != undefined && typeof smtpPort === 'number') {
    emailTranspParams.port = smtpPort;
}

if (emailUsername != undefined) {
    emailTranspParams.username = emailUsername;
}

if (emailPassword != undefined) {
    emailTranspParams.password = emailPassword;
}

// Instantiate Logger object
//
// NOTE: to add information about source file, line number and
//  function name to the logged message, one should include
//  the 'stack-track' module - using Npm.require('stack-trace'))
//  - and add a meta (last parameter) object containing the
//  key stackTrace with a value equal to stackTrace.get().
//  Example:
//  Catenis.logger.ERROR('Test error message.', {stackTrace: stackTrace.get()});
//
if (typeof Catenis === 'undefined')
    Catenis = {};

Catenis.logger = new (winston.Logger)({
    levels: log4jLevels,
    colors: log4jColors,
    padLevels: true,
    transports: [
        new (winston.transports.Console)(consoleTranspParams),
        new (winstonTransportsDailyRotateFile)(fileTranspParams),
        new (winstonTransportMail)(emailTranspParams)
    ]
});

// Filter to append prefix with source code information
Catenis.logger.filters.push(function (level, msg, meta, inst) {
    // Check whether a stack trace is passed in the meta
    if (typeof meta.stackTrace !== 'undefined') {
        // Prepare prefix with filename, linenumber and function name
        //  from trace info
        var trace = meta.stackTrace[0],
            prefix = util.format('[%s, %d', trace.getFileName(), trace.getLineNumber()),
            functionName = trace.getFunctionName();

        if (functionName != null) {
            prefix = util.format('%s (%s)]', prefix, functionName);
        }
        else {
            prefix += ']';
        }

        if (msg != undefined && msg != null && msg.length > 0) {
            // Get white spaces from beginning of message
            var spaces = '',
                match = msg.match(/^\s*/);

            if (match != null && match.length > 0) {
                spaces = match[0];
            }

            if (spaces.length > 0) {
                // Add white spaces to beginning of prefix
                //  and remove them from beginning of message
                prefix = spaces + prefix;
                msg = msg.substr(spaces.length);
            }

            if (msg.length > 0 && msg !== 'null') {
                // Append prefix to message
                msg = util.format('%s - %s', prefix, msg);
            }
            else {
                // Set message to be only the prefix
                msg = prefix;
            }
        }
        else {
            // Set message to be only the prefix
            msg = prefix;
        }

        // Make sure that stack trace is not printed
        delete meta.stackTrace;
    }
    else if (Object.keys(meta).length > 0) {
        // Some meta object has been passed.
        //  Make sure that null message is not printed
        var trimMsg = msg.trim();

        if (trimMsg === 'null') {
            msg = msg.replace('null', '');
        }
    }

    return msg;
});
