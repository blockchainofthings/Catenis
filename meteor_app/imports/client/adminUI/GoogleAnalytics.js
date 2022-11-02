/**
 * Created by claudio on 2022-10-15
 */

/**
 * Function used to activate Google Analytics
 */
export function activateGTag() {
    window.dataLayer = window.dataLayer || [];

    function gtag() {
        dataLayer.push(arguments);
    }

    gtag('js', new Date());
    gtag('config', 'AW-804580870');

    window.gtag = gtag;
}