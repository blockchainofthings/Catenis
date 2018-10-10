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
import fs from 'fs';
// Third-party node modules
import config from 'config';
import winston from 'winston';
import winstonTransportsDailyRotateFile from 'winston-daily-rotate-file';
import winstonTransportMail from 'winston-mail';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { cfgSettings as emailCfgSettings } from './ConfigEmail';

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
    ALL: 9998,
    INTERN: 9999    // Special level used exclusively to send e-mail notification messages with internal logger error
};

// Valid e-mail secure protocols with their respective default ports
const emailSecureProtocols = {
    ssl: 465,
    tls: 587
};

// Configuration settings
const cfgSettings = {
    exitOnError: loggingConfig.get('exitOnError'),
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
    ALL: 'gray',
    INTERN: 'magenta'
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
        host: emailCfgSettings.smtpHost,
        to: cfgSettings.email.toAddresses,
        from: cfgSettings.email.fromAddress,
        subject: cfgSettings.email.subject,
        html: false,
        handleExceptions: true,
        exceptionsLevel: 'FATAL',
        humanReadableUnhandledException: true,
        prettyPrint: true
    },
    // Special transport used to send e-mail notification messages with internal logger error
    internEmailTranspParams = {
        name: 'intern_mail',
        level: 'INTERN',
        unique: true,
        silent: !cfgSettings.email.active,
        host: emailCfgSettings.smtpHost,
        to: cfgSettings.email.toAddresses,
        from: cfgSettings.email.fromAddress,
        subject: cfgSettings.email.subject,
        html: false,
        handleExceptions: false,
        prettyPrint: true
    };


// Module code
//

// Make sure that log directory exists
checkLogDirExistence();

// Complement logging transport parameters
if (emailCfgSettings.secureProto) {
    if (emailCfgSettings.secureProto === 'ssl') {
        emailTranspParams.ssl = true;
        internEmailTranspParams.ssl = true;
    }
    else if (emailCfgSettings.secureProto === 'tls') {
        emailTranspParams.tls = true;
        internEmailTranspParams.tls = true;
    }
}

if (emailCfgSettings.smtpPort && typeof emailCfgSettings.smtpPort === 'number') {
    emailTranspParams.port = emailCfgSettings.smtpPort;
    internEmailTranspParams.port = emailCfgSettings.smtpPort;
}

if (emailCfgSettings.username) {
    emailTranspParams.username = emailCfgSettings.username;
    internEmailTranspParams.username = emailCfgSettings.username;
}

if (emailCfgSettings.password) {
    emailTranspParams.password = emailCfgSettings.password;
    internEmailTranspParams.password = emailCfgSettings.password;
}

// Instantiate special internal mail transport
const internMailTransport = new (winstonTransportMail.Mail)(internEmailTranspParams);

internMailTransport.on('error', (error) => {
    console.log(util.format('%s - ****** Error sending internal logger error message via e-mail.', new Date().toISOString()), error);
});

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
    emitErrs: true,
    exitOnError: cfgSettings.exitOnError,
    transports: [
        internMailTransport
    ],
    filters: [
        appendSourceCodePrefix
    ]
});

// Add (other) transports
//  Note: we do it explicitly (instead of instantiating the transport objects ourselves and
//      passing them when instantiating the logger object, via the 'transports' option entry)
//      so we can capture 'error' events emitted by the transport objects
Catenis.logger.add(winston.transports.Console, consoleTranspParams);
Catenis.logger.add(winstonTransportsDailyRotateFile, fileTranspParams);
Catenis.logger.add(winstonTransportMail.Mail, emailTranspParams);

Catenis.logger.on('error', (error, transport) => {
    if (transport && transport.name === 'mail') {
        // Error while trying to send log message via e-mail.
        //  Log error message via all other transports (except internal mail)
        const errMsg = 'Error sending log message via e-mail.';

        Object.keys(Catenis.logger.transports).forEach((key) => {
            const logTransport = Catenis.logger.transports[key];

            if (logTransport.name !== 'mail' && logTransport.name !== 'intern_mail') {
                logTransport.log('ERROR', errMsg, error, () => {});
            }
        });
    }
    else {
        // Any other error
        let errMsg;

        if (transport) {
            // Error while sending log message via a given transport
            errMsg = util.format('Error sending log message via \'%s\' transport.', transport.name);

            // Try to send error message via e-mail
            Object.keys(Catenis.logger.transports).some((key) => {
                const logTransport = Catenis.logger.transports[key];

                if (logTransport.name === 'intern_mail') {
                    logTransport.log('INTERN', errMsg, error, () => {});
                    return true;
                }

                return false;
            });
        }
        else {
            errMsg = 'Logger error.';
        }

        // Log error to console
        console.log(util.format('%s - ****** %s', new Date().toISOString(), errMsg), error);
    }
});

// Filter to append prefix with source code information
function appendSourceCodePrefix(level, msg, meta, inst) {
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
}

function checkLogDirExistence() {
    const logDirPath = path.join(process.env.PWD, logFileConfig.get('logDir'));

    // Check existence
    try {
        fs.accessSync(logDirPath);
    }
    catch (err) {
        // Assume that directory does not yet exists and try to create it
        try {
            fs.mkdirSync(logDirPath, 0o755);
        }
        catch (err2) {
            // Error creating log directory
            throw new Error('Unable to create log directory: ' + err2.toString());
        }
    }
}