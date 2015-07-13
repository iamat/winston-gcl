/*
 * winston.js: Transport for logginh to remote Google Cloud Logging API
 *
 * (C) 2015 Lars Jacob
 * MIT LICENCE
 *
 */

var events = require('events'),
    google = require('googleapis'),
    cloudlogging = google.logging("v1beta3").projects,
    util = require('util'),
    winston = require('winston'),
    googleMetadata = require("google-compute-metadata"),
    Stream = require('stream').Stream;

/**
 * Remark: This should be at a higher level.
 */
var code = /\u001b\[(\d+(;\d+)*)?m/g,
    severityWhitelist = ["DEFAULT","DEBUG","INFO","NOTICE","WARNING","ERROR","CRITICAL","ALERT","EMERGENCY"];

/**
 * Constructor function for the Google Cloud Logging transport object
 * @param {Object} options
 */
var GCL = exports.GCL = function (options) {
    var self = this;
    self.options = options || {};

    winston.Transport.call(this, options);
    if (!options.projectId) {
        throw new Error('Google ProjectId is required');
    } else if (!options.logId) {
        throw new Error('LogId is required.');
    }

    self._auth = options.auth;
    if (!self._auth) {
        self._auth = new google.auth.ComputeClient();
    }

    // process google Metadata
    if (options.googleMetadata) {
        if (!(options.googleMetadata.hasOwnProperty("id") &&
              options.googleMetadata.hasOwnProperty("zone") &&
              options.googleMetadata.hasOwnProperty("region"))) {
            throw new Error("googleMetadata malformed");
        }
        self._googleMetadata = options.googleMetadata;
    } else {
        googleMetadata.instance(function (err, data) {
            if (err) {
                return;
            }

            var zoneSplit = data.zone.split("/");
            self._googleMetadata = {
                id: data.id.toString(),
                zone: zoneSplit[zoneSplit.length - 1],
                region: zoneSplit[zoneSplit.length - 1].slice(0,-2)
            };
        });
    }

    this.name   = 'gcl';
};

/**
 * Inherit from `winston.Transport`.
 **/
util.inherits(GCL, winston.Transport);

/**
 * Expose the name of this Transport on the prototype
 */
GCL.prototype.name = 'gcl';

GCL.prototype.severityMap = {
    silly: "DEBUG",
    debug: "DEBUG",
    verbose: "NOTICE",
    info: "INFO",
    warn: "WARNING",
    error: "ERROR"
};
/**
 * Core logging method exposed to Winston. Metadata is optional.
 * @param level {string} Level at which to log the message.
 * @param msg {string} Message to log
 * @param meta {Object} **Optional** Additional metadata to attach
 * @param callback {function} Continuation to respond to when complete.
 */
GCL.prototype.log = function (level, msg, meta, callback) {
    var self = this,
        severity = self.severityMap[level];

    // ignore not supported log levels
    if (severityWhitelist.indexOf(severity) === -1) {
        return callback(null, true);
    }

    // don't log until we don't have all data necesarry
    if (!self._auth || !self._googleMetadata) {
        return callback(null, false);
    }

    if (this.silent) {
        return callback(null, true);
    }

    // remove color codes
    var payload = ('' + msg).replace(code, ''),
        params = {
            auth: self._auth,
            projectsId: self.options.projectId,
            logsId: self.options.logId
        };

    payload += " " + util.inspect(meta);

    // constructing lody entrie body
    params.resource = {
        commonLabels: {
            "compute.googleapis.com/resource_type": "instance",
            "compute.googleapis.com/resource_id": self._googleMetadata.id
        },
        entries: [{
            metadata: {
                timestamp: (new Date()).toISOString(),
                severity: severity,
                projectId: self.options.projectId,
                serviceName: "compute.googleapis.com",
                zone: self._googleMetadata.zone,
                region: self._googleMetadata.region
            },
            textPayload: payload
        }]
    };

    return cloudlogging.logs.entries.write(params, function (err) {
        if (err) {
            callback(err);
            return;
        }

        self.emit('logged');
        callback(null, true);
    });
};
