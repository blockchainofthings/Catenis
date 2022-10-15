/**
 * Created by claudio on 2022-10-15
 */

/**
 * Function used to activate Google Analytics
 */
export function activateGTag() {
    var mi_version = '8.9.1';
    var mi_track_user = true;
    var mi_no_track_reason = '';
    var disableStrs = ['ga-disable-UA-78946289-1', ];
    function __gtagTrackerIsOptedOut() {
        for (var index = 0; index < disableStrs.length; index++) {
            if (document.cookie.indexOf(disableStrs[index] + '=true') > -1) {
                return true;
            }
        }
        return false;
    }
    if (__gtagTrackerIsOptedOut()) {
        for (var index = 0; index < disableStrs.length; index++) {
            window[disableStrs[index]] = true;
        }
    }
    function __gtagTrackerOptout() {
        for (var index = 0; index < disableStrs.length; index++) {
            document.cookie = disableStrs[index] + '=true; expires=Thu, 31 Dec 2099 23:59:59 UTC; path=/';
            window[disableStrs[index]] = true;
        }
    }
    if ('undefined' === typeof gaOptout) {
        function gaOptout() {
            __gtagTrackerOptout();
        }
    }
    window.dataLayer = window.dataLayer || [];
    window.MonsterInsightsDualTracker = {
        helpers: {},
        trackers: {},
    };
    if (mi_track_user) {
        function __gtagDataLayer() {
            dataLayer.push(arguments);
        }
        function __gtagTracker(type, name, parameters) {
            if (!parameters) {
                parameters = {};
            }
            if (parameters.send_to) {
                __gtagDataLayer.apply(null, arguments);
                return;
            }
            if (type === 'event') {
                parameters.send_to = monsterinsights_frontend.ua;
                __gtagDataLayer(type, name, parameters);
            } else {
                __gtagDataLayer.apply(null, arguments);
            }
        }
        __gtagTracker('js', new Date());
        __gtagTracker('set', {
            'developer_id.dZGIzZG': true,
        });
        __gtagTracker('config', 'UA-78946289-1', {
            "forceSSL": "true",
            "link_attribution": "true"
        });
        window.gtag = __gtagTracker;
        (function() {
            var noopfn = function() {
                return null;
            };
            var newtracker = function() {
                return new Tracker();
            };
            var Tracker = function() {
                return null;
            };
            var p = Tracker.prototype;
            p.get = noopfn;
            p.set = noopfn;
            p.send = function() {
                var args = Array.prototype.slice.call(arguments);
                args.unshift('send');
                __gaTracker.apply(null, args);
            };
            var __gaTracker = function() {
                var len = arguments.length;
                if (len === 0) {
                    return;
                }
                var f = arguments[len - 1];
                if (typeof f !== 'object' || f === null || typeof f.hitCallback !== 'function') {
                    if ('send' === arguments[0]) {
                        var hitConverted,
                            hitObject = false,
                            action;
                        if ('event' === arguments[1]) {
                            if ('undefined' !== typeof arguments[3]) {
                                hitObject = {
                                    'eventAction': arguments[3],
                                    'eventCategory': arguments[2],
                                    'eventLabel': arguments[4],
                                    'value': arguments[5] ? arguments[5] : 1,
                                }
                            }
                        }
                        if ('pageview' === arguments[1]) {
                            if ('undefined' !== typeof arguments[2]) {
                                hitObject = {
                                    'eventAction': 'page_view',
                                    'page_path': arguments[2],
                                }
                            }
                        }
                        if (typeof arguments[2] === 'object') {
                            hitObject = arguments[2];
                        }
                        if (typeof arguments[5] === 'object') {
                            Object.assign(hitObject, arguments[5]);
                        }
                        if ('undefined' !== typeof arguments[1].hitType) {
                            hitObject = arguments[1];
                            if ('pageview' === hitObject.hitType) {
                                hitObject.eventAction = 'page_view';
                            }
                        }
                        if (hitObject) {
                            action = 'timing' === arguments[1].hitType ? 'timing_complete' : hitObject.eventAction;
                            hitConverted = mapArgs(hitObject);
                            __gtagTracker('event', action, hitConverted);
                        }
                    }
                    return;
                }
                function mapArgs(args) {
                    var arg,
                        hit = {};
                    var gaMap = {
                        'eventCategory': 'event_category',
                        'eventAction': 'event_action',
                        'eventLabel': 'event_label',
                        'eventValue': 'event_value',
                        'nonInteraction': 'non_interaction',
                        'timingCategory': 'event_category',
                        'timingVar': 'name',
                        'timingValue': 'value',
                        'timingLabel': 'event_label',
                        'page': 'page_path',
                        'location': 'page_location',
                        'title': 'page_title',
                    };
                    for (arg in args) {
                        if (!(!args.hasOwnProperty(arg) || !gaMap.hasOwnProperty(arg))) {
                            hit[gaMap[arg]] = args[arg];
                        } else {
                            hit[arg] = args[arg];
                        }
                    }
                    return hit;
                }
                try {
                    f.hitCallback();
                } catch (ex) {}
            };
            __gaTracker.create = newtracker;
            __gaTracker.getByName = newtracker;
            __gaTracker.getAll = function() {
                return [];
            };
            __gaTracker.remove = noopfn;
            __gaTracker.loaded = true;
            window['__gaTracker'] = __gaTracker;
        })();
    } else {
        console.log("");
        (function() {
            function __gtagTracker() {
                return null;
            }
            window['__gtagTracker'] = __gtagTracker;
            window['gtag'] = __gtagTracker;
        })();
    }
}