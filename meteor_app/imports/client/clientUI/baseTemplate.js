/**
 * Created by peter on 8/7/17.
 */
import './baseTemplate.html';


Template.baseTemplate.onCreated(function () {

});

Template.baseTemplate.onRendered(function(){
});

Template.baseTemplate.events({
    'click #lnkLogout'(event, template) {
        Meteor.logout();
        return false;
    },
    'click .menu-toggle'(event, template){
        $("#wrapper").toggleClass("toggled");
    },
});


Template.baseTemplate.helpers({

});

