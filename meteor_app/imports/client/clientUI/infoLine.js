/**
 * Created by peter on 8/24/17.
 */
import './infoLine.html';
import { Catenis } from '../ClientCatenis';


Template.infoLine.onCreated(function(){

    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);
    let client_id;
    const client= Catenis.db.collection.Client.findOne({user_id: Meteor.user()._id});

    if(client){
        client_id= client._id;
    }else{
        client_id= null;
    }

    this.clientMessageCreditsSubs = this.subscribe('clientMessageCredits', Meteor.user()._id);

});

Template.infoLine.onRendered(function(){

});

Template.infoLine.onDestroyed(function(){


    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }

    if (this.clientMessageCreditsSubs) {
        this.clientMessageCreditsSubs.stop();
    }



});

Template.infoLine.helpers({
    messageCredits: function () {

        return Catenis.db.collection.MessageCredits.findOne(1);
    },

    hasUnconfirmedMessageCredits: function (messageCredits) {
        return messageCredits && messageCredits.unconfirmed > 0;
    },

    breadCrumbs: function(){

        //    lists out the current depth of the user.
        let crumbsList;
        let path= window.location.pathname;
        crumbsList=path.split("/");
        crumbsList[0]="Home";

        //if the end url is nothing, then we remove the last element.
        if( crumbsList[crumbsList.length-1]==="" ){
            crumbsList.splice(-1,1);
        }

        return crumbsList;

    },

    lastCrumb: function(){
        //    lists out the current depth of the user.
        let crumbsList;
        let path= window.location.pathname;
        crumbsList=path.split("/");
        crumbsList[0]="Home";

        //if the end url is nothing, then we remove the last element.
        if( crumbsList[crumbsList.length-1]==="" ){
            crumbsList.splice(-1,1);
        }

        //Add specific
        const lastOne= crumbsList[crumbsList.length -1];

        if(lastOne==='devices'){
            return "add devices";
        }else{
            return lastOne;
        }

    },
    // infoLineDisplay: function(){
    //     console.log( $("#infoLine"));
    //     var width= $("#infoLine").offsetWidth;
    //     console.log(width);
    //     if(width< 500){
    //         return "none";
    //     }else{
    //         return "block";
    //     }
    //
    // },


});
