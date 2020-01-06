/**
 * Created by claudio on 2019-12-24
 */

//console.log('[CatenisOffChainMonitor.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
import util from 'util';
import EventEmitter from 'events';
// Third-party node modules
import config from 'config';
import ctnOffChainLib from 'catenis-off-chain-lib';
// Meteor packages
import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
import { Catenis } from './Catenis';
import { OffChainMsgEnvelope } from './OffChainMsgEnvelope';
import { OffChainMsgReceipt } from './OffChainMsgReceipt';
import { SendOffChainMessage } from './SendOffChainMessage';
import { CatenisOffChainNotification } from './CatenisOffChainNotification';

// Config entries
const ctnOCMonitorConfig = config.get('catenisOffChainMonitor');

// Configuration settings
const cfgSettings = {
    autoPollingTimeInterval: ctnOCMonitorConfig.get('autoPollingTimeInterval')
};

const externalEventHandlers = [];


// Definition of classes
//

// CatenisOffChainMonitor class
export class CatenisOffChainMonitor extends EventEmitter {
    static notifyEvent = Object.freeze({
        // Events used to signal current status of Catenis off-chain monitoring
        monitoringOn: Object.freeze({
            name: 'monitoring-on',
            description: 'Catenis off-chain monitoring has just been turned on'
        }),
        monitoringOff: Object.freeze({
            name: 'monitoring-off',
            description: 'Catenis off-chain monitoring has just been turned off'
        }),
        // Events to signal newly retrieved Catenis off-chain message data
        sendOCMsgRetrieved: Object.freeze({
            name: 'send-oc-msg-retrieved',
            description: 'Send off-chain message retrieved'
        }),
        ocMsgReceiptRetrieved: Object.freeze({
            name: 'oc-msg-receipt-retrieved',
            description: 'Catenis off-chain message receipt retrieved'
        })
    });

    constructor() {
        super();
        
        this.doingPoll = false;
        this.autoPollingOn = false;
        this.pollAgain = false;
        this.monitoringOn = false;
        this.waitingToStopMonitoring = false;

        this._lastRetrievedDate = undefined;
        this.app_id = undefined;
        
        this.pollingTimeIntervalHandler = undefined;

        this.ocNotifier = Catenis.ctnOCClient.notifier;

        this.ocNotifier.on(CatenisOffChainNotification.notifyEvent.connected.name, Meteor.bindEnvironment(notifyConnectedHandler, 'Catenis off-chain notifier: connected handler', this));
        this.ocNotifier.on(CatenisOffChainNotification.notifyEvent.disconnected.name, Meteor.bindEnvironment(notifyDisconnectedHandler, 'Catenis off-chain notifier: connected handler', this));
        this.ocNotifier.on(CatenisOffChainNotification.notifyEvent.newDataReady.name, Meteor.bindEnvironment(notifyNewDataReadyHandler, 'Catenis off-chain notifier: new data ready handler', this));

        // Set up event handlers
        externalEventHandlers.forEach(eventHandler => {
            //noinspection JSCheckFunctionSignatures
            this.on(eventHandler.event, eventHandler.handler);
        });
    }

    get lastRetrievedDate() {
        if (!this._lastRetrievedDate) {
            const docApp = Catenis.db.collection.Application.findOne({}, {fields: {_id: 1, lastRetrievedOCMsgDataDate: 1}});

            this.app_id = docApp._id;
            this._lastRetrievedDate = docApp.lastRetrievedOCMsgDataDate;
        }

        return this._lastRetrievedDate;
    }

    set lastRetrievedDate(value) {
        if (value instanceof Date) {
            if (!this.app_id) {
                this.app_id = Catenis.db.collection.Application.findOne({}, {fields: {_id: 1}})._id;
            }

            Catenis.db.collection.Application.update({_id: this.app_id}, {$set: {lastRetrievedOCMsgDataDate: value}});
            this._lastRetrievedDate = value;
        }
    }

    start() {
        if (!this.monitoringOn) {
            this._startAutoPolling();

            this.ocNotifier.connect();

            this.monitoringOn = true;

            // Emit event notifying that monitoring has started
            this.emit(CatenisOffChainMonitor.notifyEvent.monitoringOn.name);
        }
    }

    stop() {
        if (this.monitoringOn && !this.waitingToStopMonitoring) {
            this._stopAutoPolling();
            this.ocNotifier.disconnect();

            if (this.doingPoll) {
                this.waitingToStopMonitoring = true;
            }
            else {
                this.monitoringOn = false;

                // Emit event notifying that monitoring has stopped
                this.emit(CatenisOffChainMonitor.notifyEvent.monitoringOff.name);
            }
        }
    }
    
    _startAutoPolling() {
        if (!this.autoPollingOn) {
            this.pollingTimeIntervalHandler = Meteor.setInterval(doPolling.bind(this), cfgSettings.autoPollingTimeInterval);
            this.autoPollingOn = true;
            this._pollNow();
        }
    }
    
    _stopAutoPolling() {
        if (this.autoPollingOn) {
            if (this.pollingTimeIntervalHandler) {
                Meteor.clearInterval(this.pollingTimeIntervalHandler);
                this.pollingTimeIntervalHandler = undefined;
            }

            this.autoPollingOn = false;
        }
    }
    
    _pollNow() {
        Meteor.defer(doPolling.bind(this));
    }

    static initialize() {
        Catenis.logger.TRACE('CatenisOffChainMonitor initialization');
        Catenis.ctnOCMonitor = new CatenisOffChainMonitor();
    }

    static addEventHandler(event, handler) {
        if (!CatenisOffChainMonitor.hasInitialized()) {
            // Save event handler to be set up when object instance is created
            externalEventHandlers.push({
                event: event,
                handler: handler
            });
        }
        else {
            // CatenisOffChainMonitor object already instantiated.
            //  Just set up event handler
            Catenis.ctnOCMonitor.on(event, handler);
        }
    }

    static hasInitialized() {
        return Catenis.ctnOCMonitor !== undefined;
    }
}


// Module functions used to simulate private CatenisOffChainMonitor object methods
//  NOTE: these functions need to be bound to a CatenisOffChainMonitor object reference (this) before
//      they are called, by means of one of the predefined function methods .call(), .apply()
//      or .bind().
//

function notifyConnectedHandler() {
    Catenis.logger.TRACE('Catenis off-chain notifier: connected');
    if (this.monitoringOn && !this.waitingToStopMonitoring) {
        this._stopAutoPolling();

        this._pollNow();
    }
}

function notifyDisconnectedHandler() {
    Catenis.logger.TRACE('Catenis off-chain notifier: disconnected');
    if (this.monitoringOn && !this.waitingToStopMonitoring) {
        this._startAutoPolling();
    }
}

function notifyNewDataReadyHandler() {
    Catenis.logger.TRACE('Catenis off-chain notifier: new data ready');
    if (this.monitoringOn && !this.waitingToStopMonitoring) {
        this._pollNow();
    }
}

function doPolling() {
    Catenis.logger.TRACE('Executing process to poll for Catenis off-chain message data');
    if (!this.doingPoll) {
        try {
            this.doingPoll = true;

            // Try to get newly retrieved Catenis off-chain message data
            let newOCMsgDataInfos = [];
            let retrievedAfter = this.lastRetrievedDate;
            let skip = 0;
            let result;

            do {
                result = Catenis.ctnOCClient.getOffChainMsgData(retrievedAfter, undefined, skip);

                if ((skip = result.dataItems.length) > 0) {
                    newOCMsgDataInfos = newOCMsgDataInfos.concat(result.dataItems);
                }
            }
            while (result.hasMore);
            Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] newOCMsgDataInfos:', {
                retrievedAfter,
                newOCMsgDataInfos
            });

            let numOCMsgData;

            if ((numOCMsgData = newOCMsgDataInfos.length) > 0) {
                let processingInterrupted = false;
                let lastRetrievedDate;

                for (let idx = 0; idx < numOCMsgData; idx++) {
                    if (this.waitingToStopMonitoring) {
                        processingInterrupted = true;
                        break;
                    }

                    const ocMsgDataInfo = newOCMsgDataInfos[idx];
                    Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] ocMsgDataInfo:', ocMsgDataInfo);

                    try {
                        if (ocMsgDataInfo.dataType === ctnOffChainLib.OffChainData.msgDataType.msgEnvelope.name) {
                            const ocMsgEnvelope = new OffChainMsgEnvelope();

                            ocMsgEnvelope.load(ocMsgDataInfo);
                            Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] ocMsgEnvelope:', ocMsgEnvelope);

                            if (ocMsgEnvelope.checkAcceptRetrieved()) {
                                Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] ocMsgEnvelope accepted');
                                const sendOCMessage = SendOffChainMessage.fromOffChainMsgEnvelope(ocMsgEnvelope);
                                Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] sendOCMessage:', sendOCMessage);
                                let alreadySavedToDb = false;

                                try {
                                    ocMsgEnvelope.saveToDatabase({
                                        originDeviceId: sendOCMessage.originDevice.deviceId,
                                        targetDeviceId: sendOCMessage.targetDevice.deviceId
                                    }, false);
                                }
                                catch (err) {
                                    if (err.message === 'Error saving Catenis off-chain message data to local database' && err.duplicateDbRec === true) {
                                        // Record already saved to database. Assume that it has already been processed
                                        Catenis.logger.WARN('Retrieved Catenis off-chain message envelope already saved to database', {ocMsgEnvelope});
                                        alreadySavedToDb = true;
                                    }
                                    else {
                                        // Any other error, just rethrows it
                                        // noinspection ExceptionCaughtLocallyJS
                                        throw err;
                                    }
                                }

                                if (!alreadySavedToDb) {
                                    // Emit notification event passing newly retrieved send off-chain message
                                    Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] About to emit \'sendOCMsgRetrieved\' event');
                                    this.emit(CatenisOffChainMonitor.notifyEvent.sendOCMsgRetrieved.name, sendOCMessage);
                                }
                            }
                        }
                        else if (ocMsgDataInfo.dataType === ctnOffChainLib.OffChainData.msgDataType.msgReceipt.name) {
                            const ocMsgReceipt = new OffChainMsgReceipt();

                            ocMsgReceipt.load(ocMsgDataInfo);
                            Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] ocMsgReceipt:', ocMsgReceipt);

                            if (ocMsgReceipt.checkAcceptRetrieved()) {
                                Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] ocMsgReceipt accepted');
                                let alreadySavedToDb = false;

                                try {
                                    ocMsgReceipt.saveToDatabase(undefined, false);
                                }
                                catch (err) {
                                    if (err.message === 'Error saving Catenis off-chain message data to local database' && err.duplicateDbRec === true) {
                                        // Record already saved to database. Assume that it has already been processed
                                        Catenis.logger.WARN('Retrieved Catenis off-chain message receipt already saved to database', {ocMsgReceipt});
                                        alreadySavedToDb = true;
                                    }
                                    else {
                                        // Any other error, just rethrows it
                                        // noinspection ExceptionCaughtLocallyJS
                                        throw err;
                                    }
                                }

                                if (!alreadySavedToDb) {
                                    // Emit notification event passing newly retrieved Catenis off-chain message receipt
                                    Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] About to emit \'ocMsgReceiptRetrieved\' event');
                                    this.emit(CatenisOffChainMonitor.notifyEvent.ocMsgReceiptRetrieved.name, ocMsgReceipt);
                                }
                            }
                        }
                        else {
                            // A Catenis off-chain message data of an unexpected type has been retrieved.
                            //  Log warning condition
                            Catenis.logger.WARN('A Catenis off-chain message data of an unexpected type has been retrieved', {ocMsgDataInfo});
                        }
                    }
                    catch (err) {
                        // Error processing retrieved Catenis off-chain message data.
                        //  Log error condition
                        Catenis.logger.ERROR('Error processing retrieved Catenis off-chain message data; data discarded: %s.', util.inspect(ocMsgDataInfo), err);
                    }

                    const ocMsgDataRetrievedDate = new Date(ocMsgDataInfo.retrievedDate);

                    if (lastRetrievedDate && ocMsgDataRetrievedDate > lastRetrievedDate) {
                        // A different (more recent) retrieved date. This means that all Catenis
                        //  off-chain message data retrieved at the previous date have already
                        //  been processed. So update last retrieved date now
                        this.lastRetrievedDate = lastRetrievedDate;
                    }

                    lastRetrievedDate = ocMsgDataRetrievedDate;
                }

                if (!processingInterrupted) {
                    // Update last retried date
                    Catenis.logger.DEBUG('>>>>>> [Catenis off-chain polling] About to update last retrieved date', {lastRetrievedDate});
                    this.lastRetrievedDate = lastRetrievedDate;
                }
            }
        }
        catch (err) {
            Catenis.logger.ERROR('Error while polling for Catenis off-chain message data.', err);
        }
        finally {
            this.doingPoll = false;
            
            if (this.waitingToStopMonitoring) {
                this.pollAgain = false;
                this.monitoringOn = false;

                // Emit event notifying that monitoring has stopped
                this.emit(CatenisOffChainMonitor.notifyEvent.monitoringOff.name);
            }
            else if (this.pollAgain) {
                this.pollAgain = false;
                this._pollNow();
            }
        }
    }
    else {
        Catenis.logger.TRACE('Already polling for Catenis off-chain message data; signal to do polling again');
        this.pollAgain = true;
    }
}


// Definition of module (private) functions
//

/*function module_func() {
}*/


// Module code
//

// Lock function class
Object.freeze(CatenisOffChainMonitor);
