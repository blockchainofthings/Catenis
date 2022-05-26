/**
 * Created by claudio on 2021-10-20
 */

//console.log('[QuillConverter.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
import { JSDOM } from 'jsdom';
// Meteor packages

// References code in other (Catenis) modules


// Definition of classes
//

/**
 * Class used to convert Quill text editor contents
 *
 * NOTE: the implementation of this class is based on the implementation of the node-quill-converter-custom
 *      NPM package (https://www.npmjs.com/package/node-quill-converter-custom)
 */
export class QuillConverter {
    /**
     * Class constructor
     */
    constructor() {
        this._DOM = undefined;
        this._quill = undefined;
    }

    /**
     * Retrieve the internal HTML DOM
     * @return {*}
     */
    get DOM() {
        if (!this._DOM) {
            this._initDOM();
        }

        return this._DOM;
    }

    /**
     * Retrieve the Quill text editor object
     * @return {*}
     */
    get quill() {
        if (!this._quill) {
            this._instantiateQuill();
        }

        return this._quill;
    }

    /**
     * Convert Quill text editor contents into HTML
     * @param {Delta} delta
     * @return {string}
     */
    toHtml(delta) {
        // Resets Quill text editor's contents
        this.quill.setContents(delta, 'silent');

        // Get contents as HTML
        return this.quill.root.innerHTML;
    }

    /**
     * Clean up after HTML conversion.
     *  Note: this method should be called when done converting Quill text editor contents
     *      to HTML (by calling the toHtml() method one or more times in sequence)
     */
    htmlCleanUp() {
        // Clears Quill text editor's contents
        this.quill.setText('\n', 'silent');
    }

    /**
     * Convert Quill text editor contents into plain text
     * @param {Delta} delta
     * @return {string}
     */
    toText(delta) {
        return delta.filter(op => typeof op.insert === 'string')
            .map(op => op.insert)
            .join('');
    }

    /**
     * Initialize the internal HTML DOM
     * @private
     */
    _initDOM() {
        const JSDOM_TEMPLATE = `
  <div id="editor">hello</div>
  <script>${Assets.getText('quilljs/polyfill.js')}</script>
  <script>${Assets.getText('quilljs/quill.min.js')}</script>
  <script>
    document.getSelection = function() {
      return {
        getRangeAt: function() { }
      };
    };
    document._origExecCommand = document.execCommand;
    document.execCommand = function (command, showUI, value) {
      try {
          return document._origExecCommand(command, showUI, value);
      } catch(e) {}
      return false;
    };
  </script>
`;

        this._DOM = new JSDOM(JSDOM_TEMPLATE, {runScripts: 'dangerously', resources: 'usable'});
    }

    /**
     * Instantiate the Quill text editor object
     * @private
     */
    _instantiateQuill() {
        this._quill = new this.DOM.window.Quill('#editor');
    }
}


// Module code
//

// Lock class
Object.freeze(QuillConverter);
