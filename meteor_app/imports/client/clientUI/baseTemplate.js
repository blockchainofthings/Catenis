/**
 * Created by peter on 8/7/17.
 */
import './baseTemplate.html';
import './UserNewDevice.js';
import './infoLine.js';
import './creditPrices.js';
import { Catenis } from '../ClientCatenis';

function changeNavStructures(width){

    var toggled= "toggled" ==$("#wrapper").attr("class") ;

    if(width<580 && !toggled){
        $("#wrapper").addClass("toggled");
    }


}


const onWindowResize = function() {
    const width = $(window).width();
    changeNavStructures(width);
};

const throttledOnWindowResize = _.throttle(onWindowResize, 200, {
    leading: false
});


Template.baseTemplate.onCreated(function () {

    this.catenisClientsSubs = this.subscribe('catenisClients', Catenis.ctnHubNodeIndex);


});

Template.baseTemplate.onDestroyed(function(){

    if (this.catenisClientsSubs) {
        this.catenisClientsSubs.stop();
    }
    $(window).off('resize', throttledOnWindowResize);


});

Template.baseTemplate.onRendered(function(){

    $(window).resize(throttledOnWindowResize);


});

Template.baseTemplate.events({
    'click #lnkLogout'(event, template) {
        Meteor.logout();
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

