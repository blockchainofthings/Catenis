/**
 * Created by claudio on 02/08/17.
 */

//console.log('[Permission.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done using 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { CatenisNode } from './CatenisNode';
import { Client } from './Client';
import { Device } from './Device';

// Config entries
/*const config_entryConfig = config.get('config_entry');

// Configuration settings
const cfgSettings = {
    property: config_entryConfig.get('property_name')
};*/


// Definition of function classes
//

// Class_name function class
export function Permission(collection) {
    this.collPermission = collection;
}


// Public Permission object methods
//

// Check whether a device has permission right for a given event triggered by another device
//
//  Arguments:
//   eventName [String] - Name of permission event
//   subjectDevice [Object] - Instance of Device object for device that triggers the event
//   objectDevice [Object] - Instance of Device object for device for which permission right is being checked
//
//  Result:
//   [Boolean] - Indication of whether device has permission right or not
Permission.prototype.hasRight = function (eventName, subjectDevice, objectDevice) {
    // Retrieve rights set for given event, subject and object devices
    const docPermission = this.collPermission.findOne({
        event: eventName,
        subjectEntityId: subjectDevice.deviceId,
        $or: [{
            level: Permission.level.device.name,
            objectEntityId: objectDevice.deviceId
        }, {
            level: Permission.level.client.name,
            objectEntityId: objectDevice.client.clientId
        }, {
            level: Permission.level.catenis_node.name,
            objectEntityId: objectDevice.client.ctnNode.ctnNodeIndex
        }, {
            level: Permission.level.system.name
        }]
    }, {
        sort: {
            level: 1
        },
        fields: {
            level: 1,
            right: 1
        }
    });

    return docPermission !== undefined && docPermission.right === Permission.right.allow;
};

// Set permission rights for an event triggered by a specific device
//
//  Arguments:
//   eventName [String] - Name of permission event
//   subjectEntity [Object] - Instance of Device function class for device that triggers the event,
//                          -  or instance of Client function class for client for which default permission for all its devices is being set
//   rights: {
//     system: [string], - (optional) The right at the system level: any device. Valid values: properties of Permission.right
//     catenisNode: {  (optional) Defines the rights at the Catenis node level: any device that belongs to any client that pertains to the designated Catenis node
//       allow: [Array(String)|String], - (optional) List of Catenis node indices (or a single Catenis node index) of the Catenis nodes to give allow right
//       deny: [Array(String)|String]   - (optional) List of Catenis node indices (or a single Catenis node index) of the Catenis nodes to give deny right
//       none: [Array(String)|String]   - (optional) List of Catenis node indices (or a single Catenis node index) of the Catenis nodes from which to remove the right setting.
//                                      -              Optionally, a wildcard ('*') can be used to indicate that all right settings at the level should be removed
//     },
//     client: {       (optional) Defines the rights at the client level: any device that belongs to the designated client
//       allow: [Array(String)|String], - (optional) List of client IDs (or a single client ID) of the clients to give allow right
//       deny: [Array(String)|String]   - (optional) List of client IDS (or a single client ID) of the clients to give deny right
//       none: [Array(String)|String]   - (optional) List of client IDs (or a single client ID) of the clients from which to remove the right setting.
//                                      -              Optionally, a wildcard ('*') can be used to indicate that all rights at the level should be removed
//     },
//     device: {       (optional) Defines the rights at the device level: the designated client
//       allow: [Array(String)|String], - (optional) List of device IDs (or a single device ID) of the devices to give allow right
//       deny: [Array(String)|String]   - (optional) List of device IDS (or a single device ID) of the devices to give deny right
//       none: [Array(String)|String]   - (optional) List of device IDs (or a single device ID) of the devices from which to remove the right setting.
//                                      -              Optionally, a wildcard ('*') can be used to indicate that all rights at the level should be removed
//     }
//   }
Permission.prototype.setRights = function (eventName, subjectEntity, rights) {
    // Validate arguments
    const errArg = {};

    if (!Permission.isValidEventName(eventName)) {
        errArg.eventName = eventName;
    }

    if (!subjectEntity instanceof Device && !subjectEntity instanceof Client) {
        errArg.subjectEntity = subjectEntity;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Permission.setRights method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    // Parse rights and prepare to update the Permission database collection
    const isSubjectDevice = subjectEntity instanceof Device;
    const subjectEntityId = isSubjectDevice ? subjectEntity.deviceId : subjectEntity.clientId;
    const upsertInfos = [];
    const removeSelectors = [];
    const errorMsgs = [];
    const errorObj = {};

    for (let levelKey in rights) {
        if (levelKey === Permission.level.system.key) {
            // Make sure that right is consistent
            //noinspection JSUnfilteredForInLoop
            if (rights[levelKey] === Permission.right.allow || rights[levelKey] === Permission.right.deny) {
                // noinspection JSUnfilteredForInLoop
                upsertInfos.push({
                    selector: {
                        event: eventName,
                        subjectEntityId: subjectEntityId,
                        level: Permission.level.system.name
                    },
                    modifier: {
                        $set: {
                            right: rights[levelKey]
                        }
                    }
                });
            }
            else {
                // Invalid right. Log error and throw exception
                // noinspection JSUnfilteredForInLoop
                Catenis.logger.ERROR('Invalid right setting permission at system level', {
                    right: rights[levelKey]
                });
                // noinspection JSUnfilteredForInLoop
                throw new Meteor.Error('ctn_permission_invalid_right', util.format('Invalid right (\'%s\') setting permission at system level', rights[levelKey]));
            }
        }
        else if (levelKey === Permission.level.catenis_node.key || levelKey === Permission.level.client.key || (isSubjectDevice && levelKey === Permission.level.device.key)) {
            // noinspection JSUnfilteredForInLoop
            for (let right in rights[levelKey]) {
                if (right === Permission.right.allow || right === Permission.right.deny || right === Permission.deleteRightKey) {
                    // noinspection JSUnfilteredForInLoop
                    let entityIds = rights[levelKey][right];

                    if (!Array.isArray(entityIds)) {
                        entityIds = [entityIds];
                    }

                    // Make sure that entities are valid
                    // noinspection JSUnfilteredForInLoop
                    const checkResult = checkExistEntities(levelKey, entityIds, right === Permission.deleteRightKey);

                    if (checkResult.doExist) {
                        // noinspection JSUnfilteredForInLoop
                        const levelName = levelNameFromLevelKey(levelKey);
                        const entityIdsToRemove = [];
                        let removeAllEntities = false;

                        entityIds.forEach((entityId) => {
                            if (right !== Permission.deleteRightKey) {
                                // Prepare to insert or update right
                                // noinspection JSUnfilteredForInLoop
                                upsertInfos.push({
                                    selector: {
                                        event: eventName,
                                        subjectEntityId: subjectEntityId,
                                        level: levelName,
                                        objectEntityId: entityId
                                    },
                                    modifier: {
                                        $set: {
                                            right: right
                                        }
                                    }
                                });
                            } else {
                                // Remove right
                                if (entityId === Permission.entityToken.wildcard) {
                                    // Indicate that right entries for all entities at the given level
                                    //  should be removed
                                    removeAllEntities = true;
                                }
                                else {
                                    // Indicate that right entry for this entity should be removed
                                    entityIdsToRemove.push(entityId);
                                }
                            }
                        });

                        if (removeAllEntities) {
                            removeSelectors.push({
                                event: eventName,
                                subjectEntityId: subjectEntityId,
                                level: levelName
                            });
                        }
                        else if (entityIdsToRemove.length > 0) {
                            removeSelectors.push({
                                event: eventName,
                                subjectEntityId: subjectEntityId,
                                level: levelName,
                                objectEntityId: {
                                    $in: entityIdsToRemove
                                }
                            });
                        }
                    }
                    else {
                        // Some of the referred entities are nonexistent. Set error message
                        // noinspection JSUnfilteredForInLoop
                        const entity = Permission.entityFromLevelKey(levelKey);

                        // noinspection JSUnfilteredForInLoop
                        errorMsgs.push(util.format('Nonexistent %s (%s: %s) for %s permission right at \'%s\' level',
                                checkResult.nonexistentEntityIds.length > 1 ? entity.name.plural : entity.name.singular,
                                checkResult.nonexistentEntityIds.length > 1 ? entity.idType.plural : entity.idType.singular,
                                checkResult.nonexistentEntityIds.join(', '),
                                right === Permission.deleteRightKey ? 'removing' : util.format('setting \'%s\'', right),
                                levelKey));
                        // noinspection JSUnfilteredForInLoop
                        errorObj[levelKey] = errorObj[levelKey] !== undefined ? errorObj[levelKey].concat(checkResult.nonexistentEntityIds) : checkResult.nonexistentEntityIds;
                    }
                }
            }
        }
    }

    if (errorMsgs.length > 0) {
        // Errors found. Log them and throw exception
        const mergedErrorMsgs = errorMsgs.join('. ');

        Catenis.logger.ERROR(mergedErrorMsgs);
        throw new Meteor.Error('ctn_permission_nonexistent_entities', mergedErrorMsgs, JSON.stringify(errorObj));
    }

    // Now update Permission database collection accordingly

    // Process removes first
    removeSelectors.forEach((selector) => {
        try {
            this.collPermission.remove(selector);
        }
        catch (err) {
            // Error trying to remove permission right.
            //  Log error and throw exception
            Catenis.logger.ERROR(util.format('Error trying to remove permission right (selector: %s).', util.inspect(selector, {depth: null})), err);
            throw new Meteor.Error('ctn_permission_remove_error', util.format('Error trying to remove permission right (selector: %s).', util.inspect(selector, {depth: null})), err.stack);
        }
    });

    // Then, inserts and updates
    upsertInfos.forEach((upsertInfo) => {
        try {
            this.collPermission.upsert(upsertInfo.selector, upsertInfo.modifier);
        }
        catch (err) {
            // Error trying to set permission right.
            //  Log error and throw exception
            Catenis.logger.ERROR(util.format('Error trying to set permission right (selector: %s).', util.inspect(upsertInfo.selector, {depth: null})), err);
            throw new Meteor.Error('ctn_permission_upsert_error', util.format('Error trying to set permission right (selector: %s).', util.inspect(upsertInfo.selector, {depth: null})), err.stack);
        }
    });
};

// Retrieve the permission rights for an event triggered by a specific device
//
//  Arguments:
//   eventName [String] - Name of permission event
//   subjectEntity [Object] - Instance of Device function class for device that triggers the event,
//                          -  or instance of Client function class for client for which default permission for all its devices is being set
//
//  Result:
//   rights: {
//     system: [string], - (optional) The right at the system level: any device. Valid values: properties of Permission.right
//     catenisNode: {  (optional) Defines the rights at the Catenis node level: any device that belongs to any client that pertains to the designated Catenis node
//       allow: [Array(String)|String], - (optional) List of Catenis node indices (or a single Catenis node index) of the Catenis nodes to which have been given allow right
//       deny: [Array(String)|String]   - (optional) List of Catenis node indices (or a single Catenis node index) of the Catenis nodes to which have been given deny right
//     },
//     client: {       (optional) Defines the rights at the client level: any device that belongs to the designated client
//       allow: [Array(String)|String], - (optional) List of client IDs (or a single client ID) of the clients to which have been given allow right
//       deny: [Array(String)|String]   - (optional) List of client IDS (or a single client ID) of the clients to which have been given deny right
//     },
//     device: {       (optional) Defines the rights at the device level: the designated client
//       allow: [Array(String)|String], - (optional) List of device IDs (or a single device ID) of the devices to which have been given allow right
//       deny: [Array(String)|String]   - (optional) List of device IDS (or a single device ID) of the devices to which have been given deny right
//     }
//   }
Permission.prototype.getRights = function (eventName, subjectEntity) {
    // Validate arguments
    const errArg = {};

    if (!Permission.isValidEventName(eventName)) {
        errArg.eventName = eventName;
    }

    if (!subjectEntity instanceof Device && !subjectEntity instanceof Client) {
        errArg.subjectEntity = subjectEntity;
    }

    if (Object.keys(errArg).length > 0) {
        const errArgs = Object.keys(errArg);

        Catenis.logger.ERROR(util.format('Permission.getRights method called with invalid argument%s', errArgs.length > 1 ? 's' : ''), errArg);
        throw Error(util.format('Invalid %s argument%s', errArgs.join(', '), errArgs.length > 1 ? 's' : ''));
    }

    const isSubjectDevice = subjectEntity instanceof Device;
    const rights = {};

    this.collPermission.find({
        event: eventName,
        subjectEntityId: isSubjectDevice ? subjectEntity.deviceId : subjectEntity.clientId
    }, {
        fields: {
            level: 1,
            objectEntityId: 1,
            right: 1
        },
        sort: {
            level: -1
        }
    }).forEach((doc) => {
        if (doc.level === Permission.level.system.name) {
            rights.system = doc.right;
        }
        else if (doc.level === Permission.level.catenis_node.name || doc.level === Permission.level.client.name || doc.level === Permission.level.device.name) {
            const levelKey = levelKeyFromLevelName(doc.level);

            if (rights[levelKey] === undefined) {
                rights[levelKey] = {};
            }

            if (rights[levelKey][doc.right] === undefined) {
                rights[levelKey][doc.right] = [doc.objectEntityId];
            }
            else {
                rights[levelKey][doc.right].push(doc.objectEntityId);
            }
        }
    });

    return rights;
};


// Module functions used to simulate private Permission object methods
//  NOTE: these functions need to be bound to a Permission object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

/*function priv_func() {
}*/


// Permission function class (public) methods
//

Permission.initialize = function () {
    Catenis.logger.TRACE('Permission initialization');
    // Instantiate Permission object
    Catenis.permission = new Permission(Catenis.db.collection.Permission);
};

// Return an object the properties of which are the event names and their values the corresponding
//  event description
Permission.listEvents = function () {
    const events = {};

    Object.keys(Permission.event).forEach((key) => {
        events[Permission.event[key].name] = Permission.event[key].description
    });

    return events;
};

Permission.isValidEventName = function (eventName) {
    return Object.values(Permission.event).some((event) => event.name === eventName);
};

Permission.isValidRight = function (testRight) {
    return Object.values(Permission.right).some((right) => right === testRight);
};

Permission.isValidLevelKey = function (levelKey) {
    return Object.values(Permission.level).some((level) => level.key === levelKey);
};

Permission.entityFromLevelKey = function (levelKey) {
    const foundLevel = Object.values(Permission.level).find((level) => level.key === levelKey);

    return foundLevel !== undefined ? foundLevel.entity : undefined;
};

// Fix permission rights definition object by replacing entity ID special 'self' token with proper entity ID
//
//  Arguments:
//   rights [Object] - Rights object as defined for Permission.setRights method
//   entity [Object] - Instance of either Device or Client
Permission.fixRightsReplaceOwnHierarchyEntity = function (rights, entity) {
    const fixedRights = {};
    const replacement = {};

    if (entity instanceof Device) {
        replacement.ctnNodeIndex = entity.client.ctnNode.ctnNodeIndex;
        replacement.clientId = entity.client.clientId;
        replacement.deviceId = entity.deviceId;
    }
    else if (entity instanceof Client) {
        replacement.ctnNodeIndex = entity.ctnNode.ctnNodeIndex;
        replacement.clientId = entity.clientId;
    }

    for (let levelKey in rights) {
        if (levelKey === Permission.level.catenis_node.key || levelKey === Permission.level.client.key || levelKey === Permission.level.device.key) {
            // noinspection JSUnfilteredForInLoop
            fixedRights[levelKey] = {};

            // noinspection JSUnfilteredForInLoop
            for (let right in rights[levelKey]) {
                if (right === Permission.right.allow || right === Permission.right.deny || right === Permission.deleteRightKey) {
                    // noinspection JSUnfilteredForInLoop
                    let entityIds = rights[levelKey][right];

                    if (!Array.isArray(entityIds)) {
                        // noinspection JSUnfilteredForInLoop
                        fixedRights[levelKey][right] = entityIds === Permission.entityToken.ownHierarchy ? (levelKey === Permission.level.catenis_node.key ? replacement.ctnNodeIndex : (levelKey === Permission.level.client.key ? replacement.clientId : replacement.deviceId)) : entityIds;
                    }
                    else {
                        // noinspection JSUnfilteredForInLoop
                        fixedRights[levelKey][right] = entityIds.map((entityId) => entityId === Permission.entityToken.ownHierarchy ? (levelKey === Permission.level.catenis_node.key ? replacement.ctnNodeIndex : (levelKey === Permission.level.client.key ? replacement.clientId : replacement.deviceId)) : entityId);
                    }
                }
                // This should never happen
                else {
                    // noinspection JSUnfilteredForInLoop
                    fixedRights[levelKey][right] = rights[levelKey][right];
                }
            }
        }
        else {
            // Should be system level; just copy right
            // noinspection JSUnfilteredForInLoop
            fixedRights[levelKey] = rights[levelKey];
        }
    }

    return fixedRights;
};


// Permission function class (public) properties
//

Permission.event = Object.freeze({
    receive_notify_new_msg: Object.freeze({
        name: 'receive_notify_new_msg',
        description: 'Receive notification of new message from a device'
    }),
    receive_notify_msg_read: Object.freeze({
        name: 'receive_notify_msg_read',
        description: 'Receive notification of message read by a device'
    }),
    send_read_msg_confirm: Object.freeze({
        name: 'send_read_msg_confirm',
        description: 'Send read message confirmation to a device'
    }),
    receive_msg: Object.freeze({
        name: 'receive_msg',
        description: 'Receive message from a device'
    }),
    disclose_main_props: Object.freeze({
        name: 'disclose_main_props',
        description: 'Disclose device\'s main properties (name, product unique ID) to a device'
    })
});

Permission.level = Object.freeze({
    device: Object.freeze({
        name: '1.device',
        description: 'Permission right applies to a given device',
        key: 'device',      // Key used for setting and getting permission rights
        entity: {
            name: {
                singular: 'device',
                plural: 'devices'
            },
            idType: {
                singular: 'deviceId',
                plural: 'deviceIds'
            }
        },
    }),
    client: Object.freeze({
        name: '2.client',
        description: 'Permission right applies to any device that belongs to a given client',
        key: 'client',      // Key used for setting and getting permission rights
        entity: {
            name: {
                singular: 'client',
                plural: 'clients'
            },
            idType: {
                singular: 'clientId',
                plural: 'clientIds'
            }
        },
    }),
    catenis_node: Object.freeze({
        name: '3.catenis_node',
        description: 'Permission right applies to any device that belongs to a client that pertains to a given Catenis node',
        key: 'catenisNode',      // Key used for setting and getting permission rights
        entityName: 'Catenis node',
        entity: {
            name: {
                singular: 'Catenis node',
                plural: 'Catenis nodes'
            },
            idType: {
                singular: 'index',
                plural: 'indices'
            }
        },
    }),
    system: Object.freeze({
        name: '4.system',
        description: 'Permission right applies to any device',
        key: 'system'      // Key used for setting and getting permission rights
    })
});

Permission.right = Object.freeze({
    allow: 'allow',
    deny: 'deny'
});

Permission.deleteRightKey = 'none';

Permission.entityToken = Object.freeze({
    ownHierarchy: 'self',   // Should be used by client and device to replace Catenis Node, client ID and device ID
    wildcard: '*'           // Should be used when deleting all rights at a given level
});


// Definition of module (private) functions
//

// Return level name associated with given level key (used for setting and getting permission)
function levelNameFromLevelKey(levelKey) {
    const foundLevel = Object.values(Permission.level).find((level) => level.key === levelKey);

    return foundLevel !== undefined ? foundLevel.name : undefined;
}

// Return level key (used for setting and getting permission) associated with level name
function levelKeyFromLevelName(levelName) {
    const foundLevel = Object.values(Permission.level).find((level) => level.name === levelName);

    return foundLevel !== undefined ? foundLevel.key : undefined;
}

function checkExistEntities(levelKey, entityIds, acceptWildcard) {
    const checkResult = levelKey === Permission.level.catenis_node.key ? CatenisNode.checkExistMany(entityIds, acceptWildcard) : (levelKey === Permission.level.client.key ? Client.checkExistMany(entityIds, acceptWildcard) : Device.checkExistMany(entityIds, acceptWildcard));

    const checkResultKeys = Object.keys(checkResult);

    if (checkResultKeys.length > 1) {
        checkResult.nonexistentEntityIds = checkResult[checkResultKeys[1]];
        delete checkResult[checkResultKeys[1]];
    }

    return checkResult;
}


// Module code
//

// Lock function class
Object.freeze(Permission);
