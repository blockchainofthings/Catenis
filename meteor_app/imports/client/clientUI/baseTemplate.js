/**
 * Created by peter on 8/7/17.
 */
import './baseTemplate.html';
import './UserNewDevice.js';
import './infoLine.js';
import { Catenis } from '../ClientCatenis';

function changeNavStructures(width, height){
    var toggled= "toggled" ==$("#wrapper").attr("class") ;

    if(width<1090 && !toggled){

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

        var windowSize = $("window").offsetWidth;
        console.log(windowSize);

        //there are five sections in which things happen.

        //1. windowsize: 1085~
        //here we just toggle, don't worry about anything else.

        //2. windowsize: 921~ 1085
        //if the sidenav is small, we let the breadcrumb be. else we hide the breadcrumb
        // if(windowSize > 921 and windowSize <= 1085){
        //
        // }


        //3. windowsize: 862~921
        // regardless of toggle, we display only the estimated fees.

        //4. windowsize: 682~861
        //if toggle, don't display infoline. if not, display only the fees.


        //5. windowsize: ~681
        //don't show infoline at all. we will handle this on CSS.


        if( "toggled" ==$("#wrapper").attr("class")){
        //    side nav becomes smaller, check width to see if we want to make the thing re-appear.
            console.log("inhere");

        }else{

            console.log(document.getElementById("page-content-wrapper").offsetWidth);
            if( document.getElementById("page-content-wrapper").offsetWidth <= 812 ){
                $("#breadCrumb").addClass("hidden");
            }
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

