/**
 * Created by peter on 8/7/17.
 */
import './updateProfile.html';


function validateFormData(form, errMsgs) {
    const clientInfo = {};
    let hasError = false;

    clientInfo.name = form.clientName.value ? form.clientName.value.trim() : '';

    if (clientInfo.name.length === 0) {
        // Client name not supplied. Report error
        errMsgs.push('Please enter a client name');
        hasError = true;
    }

    clientInfo.username = form.username.value ? form.username.value.trim() : '';

    if (clientInfo.username.length === 0) {
        // Username not supplied. Report error
        errMsgs.push('Please enter a username');
        hasError = true;
    }

    clientInfo.email = form.email.value ? form.email.value.trim() : '';

    if (clientInfo.email.length === 0) {
        // Email not supplied. Report error
        errMsgs.push('Please enter an email address');
        hasError = true;
    }
    else {
        const confEmail = form.confirmEmail.value ? form.confirmEmail.value.trim() : '';

        if (clientInfo.email !== confEmail) {
            // Confirmation email does not match. Report error
            errMsgs.push('Confirmation email does not match');
            hasError = true;
        }
    }
    clientInfo.firstName = form.firstName.value? form.firstName.value.trim() : '';
    if (clientInfo.firstName.length === 0) {
        // firstName not supplied. Report error
        errMsgs.push("Please enter client's first name");
        hasError = true;
    }

    clientInfo.lastName = form.lastName.value? form.lastName.value.trim() : '';
    if (clientInfo.lastName.length === 0) {
        // firstName not supplied. Report error
        errMsgs.push("Please enter client's last name");
        hasError = true;
    }
    clientInfo.companyName= form.companyName.value? form.companyName.value.trim() : '';
    if (clientInfo.companyName.length === 0) {
        // firstName not supplied. Report error
        errMsgs.push("Please enter client's company name");
        hasError = true;
    }


    if(form.password){
        //this method is being called in the update form
        clientInfo.pwd = form.password.value ? form.password.value.trim() : '';

        if (clientInfo.pwd.length === 0) {
            // Password not supplied. We're not changing the password
        }
        else {
            const confPsw = form.confirmPassword.value ? form.confirmPassword.value.trim() : '';
            if (clientInfo.pwd !== confPsw) {
                // Confirmation password does not match. Report error
                errMsgs.push('Confirmation password does not match');
                hasError = true;
            }
        }
    }

    return !hasError ? clientInfo : undefined;
}



Template.updateProfile.onCreated(function () {
    this.state = new ReactiveDict();
    this.state.set('errMsgs', []);
    let user= Meteor.user();

    this.state.set('clientInfo',{
        name: user.profile.name,
        username: user.username,
        firstName: user.profile.firstname,
        lastName: user.profile.lastname,
        companyName: user.profile.company,
        email: user.emails? user.emails[0].address: "non-existent",
        licenseType: user.profile.license? user.profile.license.licenseType: "non-existent",
        licenseExpiry: user.profile.license? ( user.profile.license.licenseType!=="Starter"? "Unlimited": (user.profile.license.licenseRenewedDate + 2.592e+9 ).toString() ): "non-existent"
    });

});



Template.updateProfile.events({


    'click #editFormUser': function(event, template){
        event.preventDefault();
        let user= Meteor.user();

        // Populate the form fields with the data from the current form.
        $('#updateFormUser')
            .find('[name="clientName"]').val(user.profile.name).end()
            .find('[name="username"]').val(user.username).end()
            .find('[name="email"]').val(user.emails[0].address).end()
            .find('[name="confirmEmail"]').val(user.emails[0].address).end()
            .find('[name="firstName"]').val(user.profile.firstname).end()
            .find('[name="lastName"]').val(user.profile.lastname).end()
            .find('[name="companyName"]').val(user.profile.company).end();
    },

    'submit #updateFormUser'(event, template){
        event.preventDefault();
        const form = event.target;
        // Reset errors
        template.state.set('errMsgs', []);
        template.state.set('successfulUpdate', false);
        let errMsgs = [];
        let clientInfo;

        if ((clientInfo = validateFormData(form, errMsgs))) {

            Meteor.call('updateUser', clientInfo, (error) => {
                if (error) {
                    template.state.set('errMsgs', [
                        error.toString()
                    ]);
                }else {
                    // Catenis client successfully updated
                    template.state.set('successfulUpdate', true);
                    template.state.set('clientInfo', clientInfo);
                    //close modal form
                    $('#updateFormModal').modal('hide');
                    $('body').removeClass('modal-open');
                    $('.modal-backdrop').remove();
                }
            });
        }else {
            template.state.set('errMsgs', errMsgs);
        }
    }




});

Template.updateProfile.helpers({
    clientInfo: function() {
        return Template.instance().state.get('clientInfo');
    },
    successfulUpdate: function(){
        return Template.instance().state.get('successfulUpdate');
    },
    errorMessage: function () {
        return Template.instance().state.get('errMsgs').reduce((compMsg, errMsg) => {
            if (compMsg.length > 0) {
                compMsg += '<br>';
            }
            return compMsg + errMsg;
        }, '');
    },

});