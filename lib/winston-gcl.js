/*
 * winston.js: Transport for logginh to remote Google Cloud Logging API
 *
 * (C) 2015 Lars Jacob
 * MIT LICENCE
 *
 */

const google = require('googleapis');
const cloudlogging = google.logging('v2');
const util = require('util');
const winston = require('winston');
const googleMetadata = require('google-compute-metadata');
const Limiter = require('slowloris').Limiter;

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

  google.auth.getApplicationDefault((err, authClient, projectId) => {
    if (err) {
      self.emit('error', err);
      return;
    }

    if (authClient.createScopedRequired && authClient.createScopedRequired()) {
      authClient = authClient.createScoped([
        'https://www.googleapis.com/auth/logging'
      ]);
    }

    self.prefix = options.prefix ||
      `projects/${self.project}/metricDescriptors/custom.googleapis.com/`;
    self._name = `projects/${self.project}`;

    self._auth = authClient;
    self._initalized = true;
  });

  // process google Metadata
  if (options.googleMetadata) {
    if (!(options.googleMetadata.hasOwnProperty('id') &&
              options.googleMetadata.hasOwnProperty('zone') &&
              options.googleMetadata.hasOwnProperty('region'))) {
      throw new Error('googleMetadata malformed');
    }
    self._googleMetadata = options.googleMetadata;
  } else {
    googleMetadata.instance(function (err, data) {
      if (err) {
        return;
      }

      var zoneSplit = data.zone.split('/');
      self._googleMetadata = {
        id: data.id.toString(),
        zone: zoneSplit[zoneSplit.length - 1],
        region: zoneSplit[zoneSplit.length - 1].slice(0, -2)
      };
    });
  }

  this.name = 'gcl';

  this.limiter = new Limiter(500, function (logs) {
    self.bulkLog(logs.queue, function () { /* do nothing here */ });
  });
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
  silly: 'DEBUG',
  debug: 'DEBUG',
  verbose: 'NOTICE',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR'
};

/**
 * Bulk logging method
 * @param logs {Array.{{level: string, msg: string, meta: Object, date: jsDate}}} Log object
 * @param callback {function} Continuation to respond to when complete.
 */
GCL.prototype.bulkLog = function (logs, callback) {
  const self = this;
  var params;

  if (!self._auth) {
    return callback(new Error('Auth not initialized'));
  }

  if (!self._googleMetadata) {
    return callback(new Error('googleMetadata not inicialized'));
  }

  params = {
    auth: self._auth,
    resource: {}
  };

  params.resource.entries = logs.map(function (log) {
    var severity = self.severityMap[log.level];

    // set unsupported log levels to DEFAUlT
    if (!severity) {
      severity = 'DEFAULT';
    }

    var payload = log.meta;

    return {
      logName: `projects/${self.options.projectId}/logs/nodeserver`,
      resource: {
        type: 'gce_instance',
        labels: {
          instance_id: self._googleMetadata.id,
          zone: self._googleMetadata.zone
        }
      },
      timestamp: log.date.toISOString(),
      severity: severity,
      jsonPayload: payload
    };
  });

  return cloudlogging.entries.write(params, function (err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, true);
  });
};

/**
 * Core logging method exposed to Winston. Metadata is optional.
 * @param level {string} Level at which to log the message.
 * @param msg {string} Message to log
 * @param meta {Object} **Optional** Additional metadata to attach
 * @param callback {function} Continuation to respond to when complete.
 */
GCL.prototype.log = function (level, msg, meta, callback) {
  var self = this;

  if (this.silent) {
    return callback(null, true);
  }

  self.emit('logged');
  self.limiter.event({level: level, msg: msg, meta: meta || {}, date: new Date()});

  return callback(null, true);
};
