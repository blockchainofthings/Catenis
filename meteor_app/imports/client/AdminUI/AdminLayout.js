/**
 * Created by claudio on 15/05/17.
 */

//console.log('[AdminLayout.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//  NOTE: the reference of these modules are done sing 'require()' instead of 'import' to
//      to avoid annoying WebStorm warning message: 'default export is not defined in
//      imported module'
//const util = require('util');
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';


// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './AdminLayout.html';

// Import dependent templates
import './LoginTemplate.js';
import './SystemFundingTemplate.js';
import './BcotUsageReportTemplate.js';
import './ClientsTemplate.js';
import './DeviceDetailsTemplate.js';
import './NewClientTemplate.js';
import './NewDeviceTemplate.js';
import '../clientUI/updateProfile.js'
//below was added by Peter to incorporate bootstrap styling of useraccounts
import './LoginForm.js';
import './LoginBtn.js';
import './enrollAccount.js';



// Module code
//

Template.adminLayout.onCreated(function () {
    this.licenseSubs = this.subscribe('license');

});

Template.adminLayout.onDestroyed(function(){
    if(this.licenseSubs){
        this.licenseSubs.stop();
    }
});

Template.adminLayout.onRendered(function(){
});

Template.adminLayout.events({
    'click #lnkLogout'(event, template) {
        Meteor.logout();
        return false;
    },
    'click .menu-toggle'(event, template){
        $("#wrapper").toggleClass("toggled");
    },

    'click #changeLicenseConfigButton': function(event, template){
        // Populate the form fields with the data from the current data.
        $('#changeLicenseConfigForm')
            .find('[name="starter"]').val( Catenis.db.collection.License.findOne({licenseType: "Starter"}).numAllowedDevices ).end()
            .find('[name="basic"]').val( Catenis.db.collection.License.findOne({licenseType: "Basic"}).numAllowedDevices).end()
            .find('[name="professional"]').val(Catenis.db.collection.License.findOne({licenseType: "Professional"}).numAllowedDevices).end()
            .find('[name="enterprise"]').val(Catenis.db.collection.License.findOne({licenseType: "Enterprise"}).numAllowedDevices).end()
    },


    'submit #changeLicenseConfigForm'(event, template){

        const form = event.target;
        let licenseConfig= {};

        licenseConfig.starter=form.starter.value? form.starter.value: Catenis.db.collection.License.findOne({licenseType: "Starter"}).numAllowedDevices;
        licenseConfig.basic=form.basic.value?form.basic.value:Catenis.db.collection.License.findOne({licenseType: "Basic"}).numAllowedDevices;
        licenseConfig.professional=form.professional.value?form.professional.value:Catenis.db.collection.License.findOne({licenseType: "Professional"}).numAllowedDevices;
        licenseConfig.enterprise=form.enterprise.value?form.enterprise.value:Catenis.db.collection.License.findOne({licenseType: "Enterprise"}).numAllowedDevices;

        // Call remote method to update client
            Meteor.call('updateLicenseConfig', licenseConfig, (error) => {
                if (error) {

                    console.log("error attempting to update license configuration", error);

                }else {
                    // Catenis client successfully updated

                    //close modal form
                    $('#updateFormModal').modal('hide');
                    $('body').removeClass('modal-open');
                    $('.modal-backdrop').remove();
                }
            });
    },
    'click .sideNavButtons'(event, template){
        //    change all colors to original color
        var sideNav= document.getElementsByClassName("sideNavButtons");

        for ( var i=0; i< sideNav.length ; i++ ){
            sideNav[i].style.backgroundColor = "#e8e9ec";
            $(sideNav[i]).children()[0].style= "";
            $(sideNav[i]).children()[1].style= "";

            // sideNav[i].style.color = "#333399";
            sideNav[i].style = "";
        }

        (event.currentTarget).style.backgroundColor ="#5555bb";
        $(event.currentTarget).children()[0].style.color="white";
        $(event.currentTarget).children()[1].style.color="white";

    },




});


Template.adminLayout.helpers({



});

