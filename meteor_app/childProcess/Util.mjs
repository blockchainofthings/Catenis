/**
 * Created by claudio on 2021-12-11
 */

//console.log('[Util.mjs]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import _und from 'underscore';

const sensitiveDataProps = [
    'seed',
    'psw',
    'password'
];


// Definition of classes
//

// Util class
export class Util {
    static isNonNullObject(obj) {
        return typeof obj === 'object' && obj !== null;
    }

    static isNonBlankString(str) {
        return typeof str === 'string' && str.length > 0;
    }

    static maskSensitiveData(data) {
        if (Util.isNonNullObject(data)) {
            Object.getOwnPropertyNames(data)
            .forEach(prop => {
                if (prop === 'args') {
                    if (Util.isNonNullObject(data.args)) {
                        data = _und.clone(data);
                        data.args = Util.maskSensitiveData(data.args);
                    }
                }
                else if (sensitiveDataProps.includes(prop) && Util.isNonBlankString(data[prop])) {
                    data = _und.clone(data);
                    data[prop] = '******';
                }
            });
        }

        return data;
    };

    /**
     * Recursively converts values that are an instance of Uint8Array into a corresponding array of integers
     * @param {*} value The value to convert
     * @return {*}
     */
    static fromUint8Array(value) {
        if (value instanceof Uint8Array) {
            return Array.from(value);
        }
        else if (this.isNonNullObject(value)) {
            if (Array.isArray(value)) {
                return value.map(v => this.fromUint8Array(v));
            }
            else {
                return _und.mapObject(value, (v, k) => this.fromUint8Array(v));
            }
        }

        return value;
    }

    /**
     * Recursively converts values that are an array of bytes (unsigned integers not greater than 255)
     *  into a corresponding Uint8Array instance
     * @param {*} value The value to convert
     * @return {*}
     */
    static toUint8Array(value) {
        function isByteArray(value) {
            return Array.isArray(value) && value.length > 0
                && value.every(v => typeof v === 'number' && v >= 0 && v <= 0xff);
        }

        if (isByteArray(value)) {
            return new Uint8Array(value);
        }
        else if (this.isNonNullObject(value)) {
            if (Array.isArray(value)) {
                return value.map(v => this.toUint8Array(v));
            }
            else {
                return _und.mapObject(value, (v, k) => this.toUint8Array(v));
            }
        }

        return value;
    }
}


// Module code
//

// Lock class
Object.freeze(Util);
