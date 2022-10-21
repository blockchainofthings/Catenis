/**
 * Created by claudio on 2021-10-29
 */

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Third-party client javascript
import Quill from './thirdParty/quill.min';
// Meteor packages
//import { Meteor } from 'meteor/meteor';

// References code in other (Catenis) modules
//import { Catenis } from './ClientCatenis';

const Inline = Quill.import('blots/inline');
const toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
    ['blockquote', 'code-block'],

    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
    [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent

    [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],

    [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
    [{ 'font': [] }],
    [{ 'align': [] }],

    ['link'],

    ['static-field', 'lookup-field'],                 // custom buttons

    ['clean']                                         // remove formatting button
];
let quillClasses;


// Definition of classes
//

// Custom HTML tag ctn-static-field
class CtnStaticField extends HTMLElement {
    constructor() {
        super();
    }

    get name() {
        return this.getAttribute('name');
    }

    set name(value) {
        this.setAttribute('name', value);
    }
}

// Custom HTML tag ctn-lookup-field
class CtnLookupField extends HTMLElement {
    constructor() {
        super();
    }

    get source() {
        return this.getAttribute('source');
    }

    set source(value) {
        this.setAttribute('source', value);
    }

    get name() {
        return this.getAttribute('name');
    }

    set name(value) {
        this.setAttribute('name', value);
    }
}

// Custom Quill format static-field
class StaticFieldBlot extends Inline {
    static blotName = 'static-field';
    static tagName = 'ctn-static-field';

    static create(value) {
        const node = super.create();
        node.name = value;
        return node;
    }

    static formats(domNode) {
        return domNode.name;
    }

    format(name, value) {
        if (name === this.statics.blotName && value) {
            this.domNode.name = value;
        } else {
            super.format(name, value);
        }
    }
}

// Custom Quill format lookup-field
class LookupFieldBlot extends Inline {
    static blotName = 'lookup-field';
    static tagName = 'ctn-lookup-field';

    static create(value) {
        const node = super.create();
        node.source = value.source;
        node.name = value.name;
        return node;
    }

    static formats(domNode) {
        return {
            source: domNode.source,
            name: domNode.name
        };
    }

    format(name, value) {
        if (name === this.statics.blotName && value) {
            this.domNode.source = value.source;
            this.domNode.name = value.name;
        } else {
            super.format(name, value);
        }
    }
}

// QuillEditor class
export class QuillEditor {
    get quillClasses() {
        return quillClasses;
    }

    /**
     * Create a new instance of the Quill javascript editor
     * @param {string} containerSelector CSS selector for the HTML element to be used as the container for the editor
     * @param {Object} [options] Custom Quill options
     * @return {Quill} A Quill instance object
     */
    static new(containerSelector, options) {
        const defaultOptions = {
            modules: {
                toolbar: {
                    container: toolbarOptions,
                    handlers: {
                        'static-field': function (value) {
                            if (value) {
                                const range = this.quill.getSelection();
                                if (range == null || range.length === 0) return;
                                let data = this.quill.getText(range);
                                const { tooltip } = this.quill.theme;
                                tooltip.edit('static-field', data);
                            }
                            else {
                                this.quill.format('static-field', false);
                            }
                        },
                        'lookup-field': function (value) {
                            if (value) {
                                const range = this.quill.getSelection();
                                if (range == null || range.length === 0) return;
                                let data = this.quill.getText(range);
                                const { tooltip } = this.quill.theme;
                                tooltip.edit('lookup-field', data);
                            }
                            else {
                                this.quill.format('lookup-field', false);
                            }
                        }
                    }
                }
            },
            theme: 'snow'
        };
        options = options || {};

        return new Quill(containerSelector, {
            ...defaultOptions,
            ...options
        });
    }
}


// Definition of module (private) functions
//

// Declare global functions used by the patch applied to the Quill javascript editor
(global || window).QuillEditor_saveLookupSource = function (selElem) {
    if (selElem.value) {
        selElem.parentElement.parentElement.setAttribute('lookup-field-source', selElem.value);
    }
    else {
        selElem.parentElement.parentElement.removeAttribute('lookup-field-source');
    }
};

(global || window).QuillEditor_getSelectOption = function (selElem) {
    const selectedOpt = selElem.selectedOptions[0];

    return selectedOpt ? {
        name: selectedOpt.textContent,
        value: selectedOpt.value
    } : {
        name: '',
        value: ''
    };
};

(global || window).QuillEditor_setSelectOption = function (selElem, data) {
    let value;

    if (typeof data === 'string') {
        value = data;
    }
    else if (typeof data === 'object' && data !== null) {
        if ('value' in data) {
            value = data.value;
        }
        else if ('name' in data) {
            const selectedOpt = Array.from(selElem.options).find(opt => opt.textContent === data.name);

            if (selectedOpt) {
                value = selectedOpt.value;
            }
        }
    }

    selElem.value = value;
}

/**
 * Function used to apply patch to Quill javascript editor
 */
function patchQuillSnowTooltip() {
    let SnowTooltip;
    let SnowTooltipSuper;
    let Emitter;
    let Range;
    let LinkBlot;

    function getQuillClasses() {
        const dummyContainer = document.createElement('div');
        dummyContainer.setAttribute('id', '__editorDummyContainer');
        dummyContainer.style.display = 'none';

        dummyContainer.innerHTML = '<div id="__innerEditor"></div>';

        document.body.insertAdjacentElement('afterbegin', dummyContainer);

        const quill = new Quill('#__editorDummyContainer > #__innerEditor', {theme: 'snow'});

        SnowTooltip = quill.theme.tooltip.constructor;
        SnowTooltipSuper = Object.getPrototypeOf(Object.getPrototypeOf(quill.theme.tooltip)).constructor;
        Emitter = quill.selection.emitter.constructor;
        Range = quill.selection.savedRange.constructor;
        LinkBlot = Quill.import('formats/link');

        dummyContainer.remove();
    }

    function exportClasses() {
        quillClasses = {
            SnowTooltip,
            SnowTooltipSuper,
            Emitter,
            Range,
            LinkBlot
        }
    }

    function extendSnowTooltipTemplate() {
        const root = document.createElement('div');

        // Add new elements to hold embedded field data, and select client
        //  and user lookup fields
        root.innerHTML = [
            '<span class="ql-field-data"></span>',
            '<span class="ql-lookup-data">',
            '<select class="ql-lookup-source" onchange="QuillEditor_saveLookupSource(this)">',
            '<option value=""></option>',
            '<option value="client">Client</option>',
            '<option value="user">User</option>',
            '</select>',
            '<span class="ql-lookup-props">',
            '&nbsp;<b>.</b>&nbsp;',
            '<select class="ql-client-lookup">',
            '<option value=""></option>',
            '<option value="name">Name</option>',
            '<option value="firstName">Contact first name</option>',
            '<option value="lastName">Contact last name</option>',
            '<option value="company">Company</option>',
            '<option value="accountNumber">Account number</option>',
            '</select>',
            '<select class="ql-user-lookup">',
            '<option value=""></option>',
            '<option value="accName">Account name</option>',
            '<option value="email">Email</option>',
            '</select>',
            '</span>',
            '</span>'
        ].join('') + SnowTooltip.TEMPLATE;

        // Add placeholder for static field
        root.querySelector('input[type=text]').setAttribute('data-static-field', 'any name');

        // Reset template
        SnowTooltip.TEMPLATE = root.innerHTML;
    }

    function addSnowTooltipSuperProperties() {
        Object.defineProperties(
            SnowTooltipSuper.prototype,
            {
                fieldData: {
                    get: function () {
                        if (!this._fieldDataElem) {
                            this._fieldDataElem = this.root.querySelector('span.ql-field-data');
                        }

                        return this._fieldDataElem.textContent;
                    },
                    set: function (data) {
                        if (!this._fieldDataElem) {
                            this._fieldDataElem = this.root.querySelector('span.ql-field-data');
                        }

                        this._fieldDataElem.textContent = data;
                    },
                    enumerable:true
                },
                lookupSource: {
                    get: function () {
                        if (!this._lookupSourceElem) {
                            this._lookupSourceElem = this.root.querySelector('select.ql-lookup-source');
                        }

                        return QuillEditor_getSelectOption(this._lookupSourceElem);
                    },
                    set: function (data) {
                        if (!this._lookupSourceElem) {
                            this._lookupSourceElem = this.root.querySelector('select.ql-lookup-source');
                        }

                        QuillEditor_setSelectOption(this._lookupSourceElem, data);
                        QuillEditor_saveLookupSource(this._lookupSourceElem);
                    },
                    enumerable:true
                },
                clientLookup: {
                    get: function () {
                        if (!this._clientLookupElem) {
                            this._clientLookupElem = this.root.querySelector('select.ql-client-lookup');
                        }

                        return QuillEditor_getSelectOption(this._clientLookupElem);
                    },
                    set: function (data) {
                        if (!this._clientLookupElem) {
                            this._clientLookupElem = this.root.querySelector('select.ql-client-lookup');
                        }

                        QuillEditor_setSelectOption(this._clientLookupElem, data);
                    },
                    enumerable:true
                },
                userLookup: {
                    get: function () {
                        if (!this._userLookupElem) {
                            this._userLookupElem = this.root.querySelector('select.ql-user-lookup');
                        }

                        return QuillEditor_getSelectOption(this._userLookupElem);
                    },
                    set: function (data) {
                        if (!this._userLookupElem) {
                            this._userLookupElem = this.root.querySelector('select.ql-user-lookup');
                        }

                        QuillEditor_setSelectOption(this._userLookupElem, data);
                    },
                    enumerable:true
                }
            }
        );
    }

    function replaceSnowTooltipSuperEditMethod() {
        SnowTooltipSuper.prototype.edit = function (mode = 'link', preview = null) {
            this.root.classList.remove('ql-hidden');
            this.root.classList.add('ql-editing');
            let useTextBox = true;
            if (preview != null) {
                if (mode === 'link' || mode === 'static-field') {
                    this.textbox.value = preview;
                }
                else if (mode === 'lookup-field') {
                    const [source, prop] = preview.split('.');
                    this.lookupSource = source;
                    switch (source) {
                        case 'client': {
                            this.clientLookup = prop;
                            break;
                        }
                        case 'user': {
                            this.userLookup = prop;
                            break;
                        }
                    }
                    useTextBox = false;
                }
            } else if (mode !== this.root.getAttribute('data-mode')) {
                this.textbox.value = '';
            }
            this.position(this.quill.getBounds(this.quill.selection.savedRange));
            if (useTextBox) {
                setTimeout(() => this.textbox.select(), 1);
                this.textbox.setAttribute(
                    'placeholder',
                    this.textbox.getAttribute(`data-${mode}`) || '',
                );
            }
            else {
                setTimeout(() => this._lookupSourceElem.focus(), 1);
            }
            this.root.setAttribute('data-mode', mode);
            // The following line was added to workaround an issue with Safari when switching
            //  from embedded field formatting to link formatting
            setTimeout(() => this.root.classList.remove('ql-hidden'), 1);
        }
    }

    function replaceSnowTooltipSuperSaveMethod() {
        SnowTooltipSuper.prototype.save = function () {
            function extractVideoUrl(url) {
                let match =
                    url.match(
                        /^(?:(https?):\/\/)?(?:(?:www|m)\.)?youtube\.com\/watch.*v=([a-zA-Z0-9_-]+)/,
                    ) ||
                    url.match(/^(?:(https?):\/\/)?(?:(?:www|m)\.)?youtu\.be\/([a-zA-Z0-9_-]+)/);
                if (match) {
                    return `${match[1] || 'https'}://www.youtube.com/embed/${
                        match[2]
                    }?showinfo=0`;
                }
                // eslint-disable-next-line no-cond-assign
                if ((match = url.match(/^(?:(https?):\/\/)?(?:www\.)?vimeo\.com\/(\d+)/))) {
                    return `${match[1] || 'https'}://player.vimeo.com/video/${match[2]}/`;
                }
                return url;
            }

            let { value } = this.textbox;
            switch (this.root.getAttribute('data-mode')) {
                case 'link': {
                    const { scrollTop } = this.quill.root;
                    if (this.linkRange) {
                        this.quill.formatText(
                            this.linkRange,
                            'link',
                            value,
                            Emitter.sources.USER,
                        );
                        delete this.linkRange;
                    } else {
                        this.restoreFocus();
                        this.quill.format('link', value, Emitter.sources.USER);
                    }
                    this.quill.root.scrollTop = scrollTop;
                    break;
                }
                case 'video': {
                    value = extractVideoUrl(value);
                } // eslint-disable-next-line no-fallthrough
                case 'formula': {
                    if (!value) break;
                    const range = this.quill.getSelection(true);
                    if (range != null) {
                        const index = range.index + range.length;
                        this.quill.insertEmbed(
                            index,
                            this.root.getAttribute('data-mode'),
                            value,
                            Emitter.sources.USER,
                        );
                        if (this.root.getAttribute('data-mode') === 'formula') {
                            this.quill.insertText(index + 1, ' ', Emitter.sources.USER);
                        }
                        this.quill.setSelection(index + 2, Emitter.sources.USER);
                    }
                    break;
                }
                case 'static-field': {
                    if (this.staticFieldRange) {
                        if (value) {
                            // If adding static field format, make sure that any previous lookup field format is removed
                            this.quill.formatText(this.staticFieldRange, 'lookup-field', false, Emitter.sources.USER);
                        }
                        this.quill.formatText(this.staticFieldRange, 'static-field', value, Emitter.sources.USER);
                        delete this.staticFieldRange;
                    } else {
                        this.restoreFocus();
                        if (value) {
                            // If adding static field format, make sure that any previous lookup field format is removed
                            this.quill.format('lookup-field', false, Emitter.sources.USER);
                        }
                        this.quill.format('static-field', value, Emitter.sources.USER);
                    }
                    const { scrollTop } = this.quill.root;
                    this.quill.root.scrollTop = scrollTop;
                    break;
                }
                case 'lookup-field': {
                    const embeddedFieldSource = this.lookupSource.value;
                    if (embeddedFieldSource === 'client') {
                        value = this.clientLookup.value;
                    }
                    else if (embeddedFieldSource === 'user') {
                        value = this.userLookup.value;
                    }
                    if (value) {
                        value = {
                            source: embeddedFieldSource,
                            name: value
                        };
                    }
                    if (this.lookupFieldRange) {
                        if (value) {
                            // If adding lookup field format, make sure that any previous static field format is removed
                            this.quill.formatText(this.staticFieldRange, 'static-field', false, Emitter.sources.USER);
                        }
                        this.quill.formatText(this.lookupFieldRange, 'lookup-field', value, Emitter.sources.USER);
                        delete this.lookupFieldRange;
                    } else {
                        this.restoreFocus();
                        if (value) {
                            // If adding lookup field format, make sure that any previous static field format is removed
                            this.quill.format('static-field', false, Emitter.sources.USER);
                        }
                        this.quill.format('lookup-field', value, Emitter.sources.USER);
                    }
                    const { scrollTop } = this.quill.root;
                    this.quill.root.scrollTop = scrollTop;
                    break;
                }
            }
            this.textbox.value = '';
            this.hide();
        }
    }

    function replaceSnowTooltipSuperCancelMethod() {
        SnowTooltipSuper.prototype.cancel = function () {
            this.hide();
            this.restoreFocus();
        }
    }

    function replaceSnowTooltipListenMethod() {
        SnowTooltip.prototype.listen = function () {
            // The next line is a replacement for: super.listen();
            SnowTooltipSuper.prototype.listen.call(this);
            this.lookupSource;  // Required to initialize _lookupSourceElem field
            this._lookupSourceElem.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    this.save();
                    event.preventDefault();
                } else if (event.key === 'Escape') {
                    this.cancel();
                    event.preventDefault();
                }
            });
            this.clientLookup;  // Required to initialize _clientLookupElem field
            this._clientLookupElem.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    this.save();
                    event.preventDefault();
                } else if (event.key === 'Escape') {
                    this.cancel();
                    event.preventDefault();
                }
            });
            this.userLookup;  // Required to initialize _userLookupElem field
            this._userLookupElem.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    this.save();
                    event.preventDefault();
                } else if (event.key === 'Escape') {
                    this.cancel();
                    event.preventDefault();
                }
            });
            this.root.querySelector('a.ql-action').addEventListener('click', event => {
                if (this.root.classList.contains('ql-editing')) {
                    this.save();
                } else {
                    switch (this.root.getAttribute('data-mode')) {
                        case 'link': {
                            this.edit('link', this.preview.textContent);
                            break;
                        }
                        case 'static-field': {
                            this.edit('static-field', this.fieldData);
                            break;
                        }
                        case 'lookup-field': {
                            this.edit('lookup-field', this.fieldData);
                            break;
                        }
                    }
                }
                event.preventDefault();
            });
            this.root.querySelector('a.ql-remove').addEventListener('click', event => {
                switch (this.root.getAttribute('data-mode')) {
                    case 'link': {
                        if (this.linkRange != null) {
                            const range = this.linkRange;
                            this.restoreFocus();
                            this.quill.formatText(range, 'link', false, Emitter.sources.USER);
                            delete this.linkRange;
                        }
                        break;
                    }
                    case 'static-field': {
                        if (this.staticFieldRange != null) {
                            const range = this.staticFieldRange;
                            this.restoreFocus();
                            this.quill.formatText(range, 'static-field', false, Emitter.sources.USER);
                            delete this.staticFieldRange;
                        }
                        break;
                    }
                    case 'lookup-field': {
                        if (this.lookupFieldRange != null) {
                            const range = this.lookupFieldRange;
                            this.restoreFocus();
                            this.quill.formatText(range, 'lookup-field', false, Emitter.sources.USER);
                            delete this.lookupFieldRange;
                        }
                        break;
                    }
                }
                event.preventDefault();
                this.hide();
            });
            this.quill.on(
                Emitter.events.SELECTION_CHANGE,
                (range, oldRange, source) => {
                    if (range == null) return;
                    if (range.length === 0 && source === Emitter.sources.USER) {
                        {
                            // Link format
                            const [link, offset] = this.quill.scroll.descendant(
                                LinkBlot,
                                range.index,
                            );
                            if (link != null) {
                                this.linkRange = new Range(range.index - offset, link.length());
                                const preview = LinkBlot.formats(link.domNode);
                                this.preview.textContent = preview;
                                this.preview.setAttribute('href', preview);
                                this.root.setAttribute('data-mode', 'link');
                                this.show();
                                this.position(this.quill.getBounds(this.linkRange));
                                return;
                            }
                        }
                        {
                            // Static field format
                            const [staticField, offset] = this.quill.scroll.descendant(
                                StaticFieldBlot,
                                range.index,
                            );
                            if (staticField != null) {
                                this.staticFieldRange = new Range(range.index - offset, staticField.length());
                                this.fieldData = StaticFieldBlot.formats(staticField.domNode);
                                this.root.setAttribute('data-mode', 'static-field');
                                this.show();
                                this.position(this.quill.getBounds(this.staticFieldRange));
                                return;
                            }
                        }
                        {
                            // Lookup field format
                            const [lookupField, offset] = this.quill.scroll.descendant(
                                LookupFieldBlot,
                                range.index,
                            );
                            if (lookupField != null) {
                                this.lookupFieldRange = new Range(range.index - offset, lookupField.length());
                                const lookupFieldInfo = LookupFieldBlot.formats(lookupField.domNode);
                                this.fieldData = `${lookupFieldInfo.source}.${lookupFieldInfo.name}`;
                                this.root.setAttribute('data-mode', 'lookup-field');
                                this.show();
                                this.position(this.quill.getBounds(this.lookupFieldRange));
                                return;
                            }
                        }
                    } else {
                        delete this.linkRange;
                        delete this.staticFieldRange;
                        delete this.lookupFieldRange;
                    }
                    this.hide();
                },
            );
        }
    }

    function removeSnowTooltipShowMethod() {
        delete SnowTooltip.prototype.show;
    }

    function doPatch() {
        getQuillClasses();
        // Only for debugging purpose
        exportClasses();

        extendSnowTooltipTemplate();
        addSnowTooltipSuperProperties();
        replaceSnowTooltipSuperEditMethod();
        replaceSnowTooltipSuperSaveMethod();
        replaceSnowTooltipSuperCancelMethod();
        replaceSnowTooltipListenMethod();
        removeSnowTooltipShowMethod();
    }

    doPatch();
}


// Module code
//

// Patch the tooltip (popup) form used by the snow theme of the Quill javascript editor
patchQuillSnowTooltip();

// Register custom HTML tags
customElements.define('ctn-static-field', CtnStaticField);
customElements.define('ctn-lookup-field', CtnLookupField);

// Register custom Quill formats
Quill.register(StaticFieldBlot);
Quill.register(LookupFieldBlot);

// Lock class
Object.freeze(QuillEditor);
