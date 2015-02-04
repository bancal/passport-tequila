/**
 * Passport-style API for Tequila.
 */

var debug = require("debug")("passport-tequila:strategy"),
    passport = require('passport'),
    Protocol = require('./protocol.js'),
    util = require('util');

/**
 * @constructor
 * @type {Function}
 *
 * @param {String} opts.service The app-provided service name (like TequilaService in the Apache config)
 * @param {Array} opts.request The list of personal data fields to fetch, e.g. ["firstname", "displayname"]
 * @param {Array} opts.require A Tequila filter on authorized users, e.g. group=somegroup
 * @property ensureAuthenticated Simple connect middleware to ensure that the user is authenticated.
 *
 * Use this on any resource that needs to be protected, e.g.
 *
 *   app.get('/private', myTequilaStrategy.ensureAuthenticated, function(req, res){
 *      // Serve here – Can access req.user
 *   });
 */
var Strategy = module.exports = function TequilaStrategy(opts, verify) {
    if (! opts) opts = {};
    passport.Strategy.call(this, opts, verify);

    var protocol = new Protocol();
    protocol.service = opts.service || "Some node.js app";
    protocol.request = opts.request;
    protocol.require = opts.require;

    var self = this;
    this.ensureAuthenticated = function (req, res, next) {
        if (req.isAuthenticated()) { return next(); }
        debug("Not authenticated at " + req.url);
        if (req.query && req.query.key) {
            debug("Looks like user is back from Tequila, with key=" + req.query.key);
            protocol.fetchattributes(req.query.key, function (error, results) {
                if (error) {
                    next(error);
                } else {
                    req.login(teqResult2User(results), next);
                }
            });
        } else {
            debug("Making first contact with Tequila");
            protocol.createrequest(req, res, function (err, results) {
                if (err) {
                    next(err);
                } else {
                    debug("Redirecting user to Tequila");
                    protocol.requestauth(res, results);
                }
            });
        }
    }
};

/**
 * Convert a Tequila result dict into a Passport-style user structure
 *
 * @param result A dict like {user: "lecom", firstname, "Claude"} etc.
 * @returns A data structure conforming to http://passportjs.org/guide/profile/
 */
function teqResult2User(result) {
    var user = {
        provider: "tequila",
        id: result.user
    };

    if (result.displayname) {
        user.displayName = result.displayname;
    }
    if (result.name) {
        if (! user.name) user.name = {};
        user.name.familyName = result.name;
    }
    if (result.firstname) {
        if (! user.name) user.name = {};
        user.name.givenName = result.firstname;
    }
    Object.keys(result).forEach(function (k) {
        if (! user.tequila) user.tequila = {};
        user.tequila[k] = result[k];
    });
    return user;
}

util.inherits(Strategy, passport.Strategy);

Strategy.prototype.name = "tequila";
