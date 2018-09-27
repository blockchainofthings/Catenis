/**
 * Created by claudio on 2017-07-16.
 */

//console.log('[EmailContents.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import path from 'path';
// Third-party node modules
import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';

// Config entries
const emailContentsConfig = config.get('emailContents');

// Configuration settings
const cfgSettings = {
    resourcePath: emailContentsConfig.get('resourcePath'),
    subjectTemplateNameFormat: emailContentsConfig.get('subjectTemplateNameFormat'),
    htmlBodyTemplateNameFormat: emailContentsConfig.get('htmlBodyTemplateNameFormat'),
    textBodyTemplateNameFormat: emailContentsConfig.get('textBodyTemplateNameFormat')
};


// Definition of function classes
//

// EmailContents function class
//
// Constructor arguments:
//  emailName [String] - Reference name for e-mail contents. This name is used to load the corresponding contents
//                        (subject and body) of the e-mail
export function EmailContents(emailName) {
    this.emailName = emailName;

    // Try to load e-mail subject template
    try {
        this.subjectTemplate = Assets.getText(path.join(cfgSettings.resourcePath, util.format(cfgSettings.subjectTemplateNameFormat, this.emailName)));
    }
    catch (err) {
        if (err.message.startsWith('Unknown asset:')) {
            Catenis.logger.WARN('No subject template found for %s e-mail contents', this.emailName);
        }
        else {
            Catenis.logger.ERROR('Error trying to load %s e-mail contents subject template.', this.emailName, err);
            throw err;
        }
    }

    // Try to load e-mail HTML body template
    try {
        this.htmlBodyTemplate = Assets.getText(path.join(cfgSettings.resourcePath, util.format(cfgSettings.htmlBodyTemplateNameFormat, this.emailName)));
    }
    catch (err) {
        if (err.message.startsWith('Unknown asset:')) {
            Catenis.logger.WARN('No HTML body template found for %s e-mail contents', this.emailName);
        }
        else {
            Catenis.logger.ERROR('Error trying to load %s e-mail contents HTML body template.', this.emailName, err);
            throw err;
        }
    }

    // Try to load e-mail text body template
    try {
        this.textBodyTemplate = Assets.getText(path.join(cfgSettings.resourcePath, util.format(cfgSettings.textBodyTemplateNameFormat, this.emailName)));
    }
    catch (err) {
        if (err.message.startsWith('Unknown asset:')) {
            Catenis.logger.WARN('No text body template found for %s e-mail contents', this.emailName);
        }
        else {
            Catenis.logger.ERROR('Error trying to load %s e-mail contents text body template.', this.emailName, err);
            throw err;
        }
    }
}


// Public EmailContents object methods
//

// Return subject of the e-mail
//
// Arguments:
//  subjectVars [Object] - (optional) Object with key-pair dictionary containing variables to be merged with e-mail subject template
EmailContents.prototype.subject = function (subjectVars) {
    if (this.subjectTemplate) {
        return subjectVars ? mergeVariables(this.subjectTemplate, subjectVars) : this.subjectTemplate;
    }
};

// Return plain text version of the body of the e-mail
//
// Arguments:
//  bodyVars [Object] - (optional) Object with key-pair dictionary containing variables to be merged with e-mail body template
EmailContents.prototype.textBody = function (bodyVars) {
    if (this.textBodyTemplate) {
        return bodyVars ? mergeVariables(this.textBodyTemplate, bodyVars) : this.textBodyTemplate;
    }
};

// Return plain HTML version of the body of the e-mail
//
// Arguments:
//  bodyVars [Object] - (optional) Object with key-pair dictionary containing variables to be merged with e-mail body template
EmailContents.prototype.htmlBody = function (bodyVars) {
    if (this.htmlBodyTemplate) {
        return bodyVars ? mergeVariables(this.htmlBodyTemplate, bodyVars) : this.htmlBodyTemplate;
    }
};


// Module functions used to simulate private EmailContents object methods
//  NOTE: these functions need to be bound to a EmailContents object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// EmailContents function class (public) methods
//

/*EmailContents.class_func = function () {
};*/


// EmailContents function class (public) properties
//

/*EmailContents.prop = {};*/


// Definition of module (private) functions
//

function mergeVariables(template, vars, varPrefix) {
    // Search for repeat blocks
    const repeatBlockStartRegEx = /{!__repeat_begin\.([_A-Za-z][_0-9A-Za-z]*)}/g;
    let repeatBlockStarMatch;

    while ((repeatBlockStarMatch = repeatBlockStartRegEx.exec(template)) !== null) {
        // Substitute repeat block
        template = mergeRepeatBlock(template, vars, repeatBlockStarMatch[1], repeatBlockStarMatch[0], repeatBlockStarMatch.index);
    }

    return Object.keys(vars).reduce((msg, name) => {
        return msg.replace(new RegExp(util.format('{!%s%s}', varPrefix ? varPrefix + '.' : '', name), 'g'), vars[name]);
    }, template);
}

function mergeRepeatBlock(template, vars, repeatBlockId, repeatBlockStartTag, repeatBlockStartIndex) {
    const repeatBlockEndRegEx = new RegExp(util.format('{!__repeat_end\\.%s}', repeatBlockId));

    const repeatBlockEndMatch = repeatBlockEndRegEx.exec(template);

    // Make sure that repeat block end tag exists and appears after start tag
    if (repeatBlockEndMatch !== null && repeatBlockEndMatch.index > repeatBlockStartIndex) {
        if (Array.isArray(vars[repeatBlockId])) {
            const repeatTemplate = template.substring(repeatBlockStartIndex + repeatBlockStartTag.length, repeatBlockEndMatch.index);

            // Compute string to replace repeat block
            const repeatSubsStr = vars[repeatBlockId].reduce((subsStr, repeatVars) => {
                return subsStr + mergeVariables(repeatTemplate, repeatVars, repeatBlockId);
            }, '');

            // Replace repeat block
            template = template.substring(0, repeatBlockStartIndex) + repeatSubsStr + template.substring(repeatBlockEndMatch.index + repeatBlockEndMatch[0].length);
        }
    }

    return template;
}


// Module code
//

// Lock function class
Object.freeze(EmailContents);
