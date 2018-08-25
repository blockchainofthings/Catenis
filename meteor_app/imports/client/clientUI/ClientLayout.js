/**
 * Created by Claudio on 2017-08-07.
 */
//console.log('[ClientLayout.js]: This code just ran.');

// Module variables
//

// References to external code
//
// Internal node modules
//import util from 'util';
// Third-party node modules
//import config from 'config';
// Meteor packages
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { AccountsTemplates } from 'meteor/useraccounts:core';

// References code in other (Catenis) modules on the client
import { Catenis } from '../ClientCatenis';

// Import template UI
import './ClientLayout.html';

// Import dependent templates
import './UserNewDevice.js';
import './infoLine.js';
import './creditPrices.js';


// Definition of module (private) functions
//

function redirectHome() {
    const user = Meteor.user();
    const user_id = user ? user._id : Meteor.userId();

    if (Roles.userIsInRole(user_id, 'sys-admin')) {
        FlowRouter.go('/admin');
    }
    else if (Roles.userIsInRole(user_id, 'ctn-client')) {
        FlowRouter.go('/');
    }
}

function changeNavStructures(width) {
    var toggled= "toggled" ==$("#wrapper").attr("class") ;

    if(width<580 && !toggled){
        $("#wrapper").addClass("toggled");
    }
}

function onWindowResize() {
    const width = $(window).width();
    changeNavStructures(width);
}


// Module code
//

Template.clientLayout.onCreated(function () {
    this.state = new ReactiveDict();

    this.state.set('appEnv', undefined);

    Meteor.call('getAppEnvironment', (err, env) => {
        if (err) {
            console.log('Error calling \'getAppEnvironment\' remote procedure.', err);
        }
        else {
            this.state.set('appEnv', env);
        }
    });

    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
});

const throttledOnWindowResize = _.throttle(onWindowResize, 200, {
    leading: false
});

Template.clientLayout.onDestroyed(function(){
    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }
    $(window).off('resize', throttledOnWindowResize);
});

Template.clientLayout.onRendered(function(){
    $(window).resize(throttledOnWindowResize);
});

Template.clientLayout.events({
    'click #lnkLogout'(event, template) {
        AccountsTemplates.logout();
        return false;
    },
    'click .menu-toggle'(event, template){
        $("#wrapper").toggleClass("toggled");
        var sideNavSmall;

        if( "toggled" ==$("#wrapper").attr("class")){
            //    side nav becomes smaller, check width to see if we want to make the thing re-appear.
            sideNavSmall= true;
        }else{
            sideNavSmall= false;
        }

        var windowSize = $(window).width();
        if( windowSize <= 500 && !sideNavSmall ){
            $(".infoLine").addClass("hidden");
        }else{
            $(".infoLine").removeClass("hidden");
        }

        return false;
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
    'click .navbar-brand'(event, template) {
        redirectHome();
        return false;
    },
    'click #lnkCtnTitle'(event, template) {
        redirectHome();
        return false;
    }
});

Template.clientLayout.helpers({
    login() {
        if (!Meteor.user() && !Meteor.userId()) {
            FlowRouter.go('/login');
        }
    },
    appEnvironment() {
        return Template.instance().state.get('appEnv');
    },
    isNonProdEnvironment(env) {
        return env && env.toLowerCase() !== 'production';
    },
    capitalize(str) {
        if (str) {
            return str.substr(0, 1).toUpperCase() + str.substr(1);
        }
    }
});

