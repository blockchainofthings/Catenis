/**
 * Created by claudio on 25/11/15.
 */

//console.log('[Startup.js]: This code just ran.');

// Module code
//

// Initialization code (on the server)
Meteor.startup(function () {
    Catenis.logger.INFO('Starting initialization...');
    Catenis.module.DB.inititalize();
    Catenis.module.Application.initialize();
    Catenis.module.KeyStore.initialize();
    Catenis.module.BitcoinCore.initialize();
    Catenis.module.ColoredCoins.initialize();
    Catenis.module.CatenisHubAddress.initialize();
    Catenis.logger.INFO('Initialization ended.');
});
