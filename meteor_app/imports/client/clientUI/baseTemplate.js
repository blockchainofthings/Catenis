/**
 * Created by peter on 8/7/17.
 */
import './baseTemplate.html';
import './UserNewDevice.js';
import './infoLine.js';
import { Catenis } from '../ClientCatenis';

Template.baseTemplate.onCreated(function () {

    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);

});

Template.baseTemplate.onDestroyed(function(){

    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }

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

    myClient: function () {
        const client= Catenis.db.collection.Client.findOne({user_id: Meteor.user()._id});
        if(client){
            return client._id;
        }else{
            //this is only necessary because right now the catenisadmin has no client.
            return null;
        }
    },

});

