/**
 * Created by peter on 7/11/17.
 */
import './LoginForm.html';

//overriding the atForm from useraccounts module to custom style it with bootstrap.
Template.LoginForm.replaces("atPwdForm");

Template.login.events({
    'click #login-form-link'(event, template) {
        AccountsTemplates.setState('signIn');
    },

    'click #forgotPwd-form-link'(event, template){
        AccountsTemplates.setState('forgotPwd');
    },

});





Template.login.helpers({
    atFormTitle: function () {

        if( AccountsTemplates.getState() === 'signIn' ){
            return "LOGIN";
            // }else if(AccountsTemplates.getState() === 'signUp'){
            //     return "REGISTER";
        }else if(AccountsTemplates.getState() === 'forgotPwd'){
            return "RESET PASSWORD";
        }else if(AccountsTemplates.getState() === 'enrollAccount'){
            return "ENROLL ACCOUNT";
        }else if(AccountsTemplates.getState() === 'resetPwd'){
            return "RESET PASSWORD NOW";
        }else{
            return "Something went wrong";
        }
    },
    equals: function(v1, v2){
        return (v1===v2);
    }
});


Template.atForm.helpers(AccountsTemplates.atFormHelpers);
