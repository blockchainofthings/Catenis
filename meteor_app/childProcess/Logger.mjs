/**
 * Created by claudio on 2021-12-13.
 */

//console.log('[Logger.mjs]: This code just ran.');

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
import 'winston-daily-rotate-file';
import 'winston-mail';
import { LEVEL } from 'triple-beam';

// Config entries
const loggingConfig = config.get('logging');
const logPrefixConfig = loggingConfig.has('prefix') ? loggingConfig.get('prefix') : undefined;
const logConsoleConfig = loggingConfig.get('console');
const logFileConfig = loggingConfig.get('file');
const logEmailConfig = loggingConfig.get('email');
const emailConfig = config.get('email');

// Configuration settings
const cfgSettings = {
    exitOnError: loggingConfig.get('exitOnError'),
    objInspectionDepth: loggingConfig.get('objInspectionDepth'),
    prefix: logPrefixConfig ? {
        label: logPrefixConfig.get('label'),
        format: logPrefixConfig.get('format'),
        showProcessId: logPrefixConfig.get('showProcessId')
    } : undefined,
    console: {
        active: logConsoleConfig.get('active'),
        logLevel: logConsoleConfig.get('logLevel')
    },
    file: {
        active: logFileConfig.get('active'),
        logLevel: logFileConfig.get('logLevel'),
        logDir: logFileConfig.get('logDir'),
        logFilename: logFileConfig.get('logFilename'),
        maxDays: logFileConfig.get('maxDays')
    },
    email: {
        active: logEmailConfig.get('active'),
        logLevel: logEmailConfig.get('logLevel'),
        toAddresses: logEmailConfig.get('toAddresses'),
        fromAddress: logEmailConfig.get('fromAddress'),
        subject: logEmailConfig.get('subject')
    }
};
const emailCfgSettings = {
    smtpHost: emailConfig.get('smtpHost'),
    secureProto: emailConfig.get('secureProto'),
    smtpPort: emailConfig.has('smtpPort') ? emailConfig.get('smtpPort') : undefined,
    username: emailConfig.has('username') ? emailConfig.get('username') : undefined,
    password: emailConfig.has('password') ? emailConfig.get('password') : undefined
};

const appendProcessPrefix = winston.format((info, opts) => {
    if (cfgSettings.prefix && typeof info.message === 'string' && info.message.length > 0) {
        const firstCharIdx = info.message.search(/\S/);

        if (firstCharIdx >= 0) {
            info.message = info.message.slice(0, firstCharIdx) + util.format(cfgSettings.prefix.format, cfgSettings.prefix.label + (cfgSettings.prefix.showProcessId ? '(' + process.pid + ')' : '')) + info.message.slice(firstCharIdx);
        }
    }

    return info;
});

const mergeMetaArguments = winston.format((info, opts) => {
    if (info.metaArgs) {
        // Incorporate metadata arguments into the message itself
        const args = info.metaArgs.concat();

        // Check for literal objects and arrays and replace them with their corresponding string
        //  representation so they appear in a new line
        args.forEach((arg, idx) => {
            if (typeof arg === 'object' && arg !== null && arg.constructor && ((arg.constructor.name === 'Object' && Object.keys(arg).length > 0) || (arg.constructor.name === 'Array' && arg.length > 0))) {
                args[idx] = '\n' + util.inspect(arg, {depth: cfgSettings.objInspectionDepth, colors: opts && opts.colors});
            }
        });

        // Adjust default inspect options if required
        let colorsOptReset = false;
        let defaultDepthOpt;

        if (opts && opts.colors && !util.inspect.defaultOptions.colors) {
            util.inspect.defaultOptions.colors = true;
            colorsOptReset = true;
        }

        if (cfgSettings.objInspectionDepth !== util.inspect.defaultOptions.depth) {
            defaultDepthOpt = util.inspect.defaultOptions.depth;
            util.inspect.defaultOptions.depth = cfgSettings.objInspectionDepth;
        }

        // Merge arguments
        info.message = util.format(info.message, ...args);

        // Reset default inspect options if necessary
        if (colorsOptReset) {
            util.inspect.defaultOptions.colors = false;
        }

        if (defaultDepthOpt) {
            util.inspect.defaultOptions.depth = defaultDepthOpt;
        }
    }

    return info;
});


// Definition of function classes
//

// Logger function class
export function Logger() {
    // Instantiate the logger object itself
    this._logger = winston.createLogger({
        levels: Logger.logSeverity.levels,
        level: 'INFO',
        exitOnError: cfgSettings.exitOnError,
        transports: getBasicTransports.call(this)
    });

    winston.addColors(Logger.logSeverity.colors);

    // Set up logger error handler
    this._logger.on('error', loggerErrorHandler.bind(this))
}


// Public Logger object methods
//

Logger.prototype._log = function (transport, level, message, ...args) {
    try {
        const info = {
            level: level,
            message: message
        };

        if (args.length > 0) {
            info.metaArgs = args;
        }

        if (transport) {
            // Make sure to add level symbol entry and to include dummy callback
            info[LEVEL] = level;
            transport._write(info, 'utf8', () => {
            });
        }
        else {
            this._logger.log(info);
        }
    }
    catch (err) {
        if (typeof err === 'object' && err !== null) {
            err.logInfo = {
                level,
                message,
                args
            };
        }

        console.error(`${new Date().toISOString()} - ****** Error logging message.`, err);
    }
};

Logger.prototype.addEmailTransports = function (cipherFns) {
    getEmailTransports(cipherFns)
    .forEach(transport => {
        this._logger.add(transport);
    });
};


// Module functions used to simulate private Logger object methods
//  NOTE: these functions need to be bound to a Logger object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function getBasicTransports() {
    const transportOptions = {
        console: {
            level: validLogLevel(cfgSettings.console.logLevel, 'INFO'),
            silent: !cfgSettings.console.active,
            handleExceptions: true,
            exceptionsLevel: 'FATAL',
            humanReadableUnhandledException: true,
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                appendProcessPrefix(),
                mergeMetaArguments({colors: true}),
                winston.format.printf(formatLogMessage)
            )
        },
        dailyRotateFile: {
            level: validLogLevel(cfgSettings.file.logLevel, 'DEBUG'),
            silent: !cfgSettings.file.active,
            handleExceptions: true,
            exceptionsLevel: 'FATAL',
            humanReadableUnhandledException: true,
            datePattern: 'YYYY-MM-DD',
            dirname: path.join(process.env.PWD, cfgSettings.file.logDir),
            filename: cfgSettings.file.logFilename,
            maxFiles: cfgSettings.file.maxDays + 'd',
            auditFile: path.join(process.env.PWD, cfgSettings.file.logDir, '.log-audit.json'),
            format: winston.format.combine(
                winston.format.timestamp(),
                appendProcessPrefix(),
                mergeMetaArguments({colors: false}),
                winston.format.printf(formatLogMessage)
            )
        }
    };

    if (!transportOptions.dailyRotateFile.silent) {
        // Logging to file is active. Make sure that logging directory exists
        try {
            fs.accessSync(transportOptions.dailyRotateFile.dirname);
        }
        catch (err) {
            // Assume that directory does not yet exists and try to create it
            try {
                fs.mkdirSync(transportOptions.dailyRotateFile.dirname, 0o755);
            }
            catch (err2) {
                // Error creating log directory
                throw new Error('Unable to create log directory: ' + err2.toString());
            }
        }
    }

    // Instantiate and return basic logging transports
    return [
        new winston.transports.Console(transportOptions.console),
        new winston.transports.DailyRotateFile(transportOptions.dailyRotateFile)
    ];
}

function getEmailTransports(cipherFns) {
    const transportOptions = {
        email: {
            level: validLogLevel(cfgSettings.email.logLevel, 'WARN'),
            silent: !cfgSettings.email.active,
            host: emailCfgSettings.smtpHost,
            to: cfgSettings.email.toAddresses,
            from: cfgSettings.email.fromAddress,
            subject: cfgSettings.email.subject,
            html: false,
            handleExceptions: true,
            exceptionsLevel: 'FATAL',
            humanReadableUnhandledException: true,
            format: winston.format.combine(
                appendProcessPrefix(),
                mergeMetaArguments({colors: false})
            )
        },
        // Special transport used to send e-mail notification messages with internal logger error
        internEmail: {
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
            format: winston.format.combine(
                appendProcessPrefix(),
                mergeMetaArguments({colors: false})
            )
        }
    };

    // Complement options for e-mail logging transports
    if (emailCfgSettings.secureProto) {
        if (emailCfgSettings.secureProto === 'ssl') {
            transportOptions.email.ssl = true;
            transportOptions.internEmail.ssl = true;
        }
        else if (emailCfgSettings.secureProto === 'tls') {
            transportOptions.email.tls = true;
            transportOptions.internEmail.tls = true;
        }
    }

    if (emailCfgSettings.smtpPort && typeof emailCfgSettings.smtpPort === 'number') {
        transportOptions.email.port = emailCfgSettings.smtpPort;
        transportOptions.internEmail.port = emailCfgSettings.smtpPort;
    }

    if (emailCfgSettings.username) {
        transportOptions.email.username = emailCfgSettings.username;
        transportOptions.internEmail.username = emailCfgSettings.username;
    }

    if (emailCfgSettings.password) {
        transportOptions.email.password = cipherFns.decipher(emailCfgSettings.password);
        transportOptions.internEmail.password = cipherFns.decipher(emailCfgSettings.password);
    }

    // Instantiate logging transports
    const internEmail = new winston.transports.Mail(transportOptions.internEmail);

    // Set up logging transport specific event handlers
    internEmail.on('error', internMailErrorHandler);

    return [
        internEmail,
        new winston.transports.Mail(transportOptions.email),
    ];
}


// Logger function class (public) methods
//

Logger.initialize = function () {
    addLoggingMethods();

    // Instantiate global Logger object
    global.logger = new Logger();
};


// Logger function class (public) properties
//

Logger.logSeverity = Object.freeze({
    levels: Object.freeze({
        FATAL: 0,
        error: 101,     // Workaround to properly log exceptions (otherwise, winston fails with the following error message: "[winston] Unknown logger level: error")
        ERROR: 100,
        ACTION: 150,
        WARN: 200,
        INFO: 300,
        DEBUG: 400,
        TRACE: 500,
        ALL: 9998,
        INTERN: 9999    // Special level used exclusively to send e-mail notification messages with internal logger error
    }),
    colors: Object.freeze({
        FATAL: 'magenta',
        error: 'red',
        ERROR: 'red',
        ACTION: 'cyan',
        WARN: 'yellow',
        INFO: 'blue',
        DEBUG: 'green',
        TRACE: 'gray',
        ALL: 'gray',
        INTERN: 'magenta'
    })
});

Logger.largestLevelLength = computeLargestLevelLength();


// Definition of module (private) functions
//

function computeLargestLevelLength() {
    return Object.keys(Logger.logSeverity.levels).reduce((largestLength, level) => {
        return level.length > largestLength ? level.length : largestLength;
    }, 0);
}

function addLoggingMethods() {
    Object.keys(Logger.logSeverity.levels).forEach((level) => {
        Logger.prototype[level] = function (message, ...args) {
            return this._log(null, level, message, ...args);
        };
    });
}

function validLogLevel(level, defaultLevel) {
    return level in Logger.logSeverity.levels ? level : defaultLevel;
}

function formatLogMessage(info) {
    const paddingLength = Logger.largestLevelLength - info[LEVEL].length;
    const padding = paddingLength > 0 ? Buffer.alloc(paddingLength, ' ').toString() : '';
    const prefix = info.timestamp ? `${info.timestamp} - ` : '';

    return `${prefix}${info.level}:${padding} ${info.message}`;
}

function internMailErrorHandler(error) {
    console.error(util.format('%s - ****** Error sending internal logger error message via e-mail.', new Date().toISOString()), error);
}

function loggerErrorHandler(error, transport) {
    if (transport && transport.name === 'mail') {
        // Error while trying to send log message via e-mail.
        //  Log error message via all other transports (except internal e-mail)
        const errMsg = 'Error sending log message via e-mail.';

        Object.keys(this._logger.transports).forEach((key) => {
            const logTransport = this._logger.transports[key];

            if (logTransport.name !== 'mail' && logTransport.name !== 'intern_mail') {
                this._log(logTransport, 'ERROR', errMsg, error);
            }
        });
    }
    else {
        // Any other error
        let errMsg;

        if (transport) {
            // Make sure that we do not handle internal e-mail error, since it has its own error handler
            if (transport.name !== 'intern_mail') {
                // Error while sending log message via a given transport (except internal e-mail)
                errMsg = util.format('Error sending log message via \'%s\' transport.', transport.name);

                // Try to send error message via e-mail
                Object.keys(this._logger.transports).some((key) => {
                    const logTransport = this._logger.transports[key];

                    if (logTransport.name === 'intern_mail') {
                        this._log(logTransport, 'INTERN', errMsg, error);

                        return true;
                    }

                    return false;
                });
            }
        }
        else {
            errMsg = 'Logger error.';
        }

        if (errMsg) {
            // Log error to console
            console.error(util.format('%s - ****** %s', new Date().toISOString(), errMsg), error);
        }
    }
}


// Module code
//

// Lock function class
Object.freeze(Logger);
