/**
 * Created by Claudio on 2015-11-26.
 */

//console.log('[Logging.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import path from 'path';
// Third-party node modules
import config from 'config';
import winston from 'winston';
import winstonTransportsDailyRotateFile from 'winston-daily-rotate-file';
import winstonTransportMail from 'winston-mail';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const loggingConfig = config.get('logging');
const logConsoleConfig = loggingConfig.get('console');
const logFileConfig = loggingConfig.get('file');
const logEmailConfig = loggingConfig.get('email');

// Definition of logging levels based on Log4J
const log4jLevels = {
    FATAL: 0,
    ERROR: 100,
    ACTION: 150,
    WARN: 200,
    INFO: 300,
    DEBUG: 400,
    TRACE: 500,
    ALL: 9999
};

// Valid e-mail secure protocols with their respective default ports
const emailSecureProtocols = {
    ssl: 465,
    tls: 587
};

// Configuration settings
const cfgSettings = {
    console: {
        active: logConsoleConfig.get('active'),
        logLevel: logConsoleConfig.has('logLevel') && (logConsoleConfig.get('logLevel') in log4jLevels) ? logConsoleConfig.get('logLevel') : 'INFO'
    },
    file: {
        active: logFileConfig.get('active'),
        logLevel: logFileConfig.has('logLevel') && (logFileConfig.get('logLevel') in log4jLevels) ? logFileConfig.get('logLevel') : 'ALL',
        logDir: logFileConfig.get('logDir'),
        logFilename: logFileConfig.get('logFilename'),
        maxDays: logFileConfig.get('maxDays')
    },
    email: {
        active: logEmailConfig.get('active'),
        logLevel: logEmailConfig.has('logLevel') && (logEmailConfig.get('logLevel') in log4jLevels) ? logEmailConfig.get('logLevel') : 'WARN',
        smtpHost: logEmailConfig.get('smtpHost'),
        secureProto: logEmailConfig.has('secureProto') && (logEmailConfig.get('secureProto') in emailSecureProtocols) ? logEmailConfig.get('secureProto') : undefined,
        smtpPort: logEmailConfig.has('smtpPort') ? logEmailConfig.get('smtpPort') : undefined,
        username: logEmailConfig.has('username') ? logEmailConfig.get('username') : undefined,
        password: logEmailConfig.has('password') ? logEmailConfig.get('password') : undefined,
        toAddresses: logEmailConfig.get('toAddresses'),
        fromAddress: logEmailConfig.get('fromAddress'),
        subject: logEmailConfig.get('subject')
    }
};

const log4jColors = {
    FATAL: 'magenta',
    ERROR: 'red',
    ACTION: 'cyan',
    WARN: 'yellow',
    INFO: 'blue',
    DEBUG: 'green',
    TRACE: 'gray',
    ALL: 'gray'
};

// Definition of parameters for each different logging output (transport)
const consoleTranspParams = {
        level: cfgSettings.console.logLevel,
        silent: !cfgSettings.console.active,
        colorize: true,
        handleExceptions: true,
        exceptionsLevel: 'FATAL',
        humanReadableUnhandledException: true,
        timestamp: true,
        debugStdout: true,
        prettyPrint: true
    },
    fileTranspParams = {
        level: cfgSettings.file.logLevel,
        silent: !cfgSettings.file.active,
        colorize: false,
        handleExceptions: true,
        exceptionsLevel: 'FATAL',
        humanReadableUnhandledException: true,
        filename: path.join(process.env.PWD, cfgSettings.file.logDir, cfgSettings.file.logFilename),
        maxDays: cfgSettings.file.maxDays,
        json: false,
        prettyPrint: true
    },
    emailTranspParams = {
        level: cfgSettings.email.logLevel,
        silent: !cfgSettings.email.active,
        host: cfgSettings.email.smtpHost,
        to: cfgSettings.email.toAddresses,
        from: cfgSettings.email.fromAddress,
        subject: cfgSettings.email.subject,
        html: false,
        handleExceptions: true,
        exceptionsLevel: 'FATAL',
        humanReadableUnhandledException: true,
        prettyPrint: true
    };


// Module code
//

// Complement logging transport parameters
if (cfgSettings.email.secureProto !== undefined) {
    if (cfgSettings.email.secureProto === 'ssl') {
        emailTranspParams.ssl = true;
    }
    else if (emailTranspParams === 'tls') {
        emailTranspParams.tls = true;
    }
}

if (cfgSettings.email.smtpPort !== undefined && typeof cfgSettings.email.smtpPort === 'number') {
    emailTranspParams.port = cfgSettings.email.smtpPort;
}

if (cfgSettings.email.username !== undefined) {
    emailTranspParams.username = cfgSettings.email.username;
}

if (cfgSettings.email.password !== undefined) {
    emailTranspParams.password = cfgSettings.email.password;
}

// Instantiate Logger object
//
// NOTE: to add information about source file, line number and
//  function name to the logged message, one should include
//  the 'stack-track' module - import stack-track from 'stack-track'
//  - and add a meta (last parameter) object containing the
//  key stackTrace with a value equal to stackTrace.get().
//  Example:
//  Catenis.logger.ERROR('Test error message.', {stackTrace: stackTrace.get()});
//
Catenis.logger = new (winston.Logger)({
    levels: log4jLevels,
    colors: log4jColors,
    padLevels: true,
    transports: [
        new (winston.transports.Console)(consoleTranspParams),
        new (winstonTransportsDailyRotateFile)(fileTranspParams),
        new (winstonTransportMail.Mail)(emailTranspParams)
    ]
});

// Filter to append prefix with source code information
Catenis.logger.filters.push(function (level, msg, meta, inst) {
    // Check whether a stack trace is passed in the meta
    if (typeof meta === 'object' && meta !== null) {
        if (typeof meta.stackTrace !== 'undefined') {
            // Prepare prefix with filename, linenumber and function name
            //  from trace info
            const trace = meta.stackTrace[0];
            let prefix = util.format('[%s, %d', trace.getFileName(), trace.getLineNumber());
            const functionName = trace.getFunctionName();

            if (functionName != null) {
                prefix = util.format('%s (%s)]', prefix, functionName);
            }
            else {
                prefix += ']';
            }

            if (msg !== undefined && msg != null && msg.length > 0) {
                // Get white spaces from beginning of message
                let spaces = '';
                const match = msg.match(/^\s*/);

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
            const trimMsg = msg.trim();

            if (trimMsg === 'null') {
                msg = msg.replace('null', '');
            }
        }
    }

    return msg;
});
