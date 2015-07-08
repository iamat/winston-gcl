/*
 * winston-glc-test.js: Tests for instances of the GLC transport
 *
 * (C) 2015 Lars Jacob
 * MIT LICENSE
 *
 */

var path = require('path'),
    vows = require('vows'),
    assert = require('assert'),
    winston = require('winston'),
    helpers = require('winston/test/helpers'),
    GCL = require('../lib/winston-gcl').GCL;

var tokenTransport,
    config;

try {
    config = require('./config');
}
catch (ex) {
    console.log('Error reading test/config.json.');
    console.log('Are you sure it exists?\n');
    console.dir(ex);
    process.exit(1);
}

tokenTransport = new (GCL)({
    subdomain: config.transports.loggly.subdomain,
    token: config.transports.loggly.token
});

function assertLoggly(transport) {
    assert.instanceOf(transport, GCL);
    assert.isFunction(transport.log);
}

vows.describe('winston-glc').addBatch({
    "An instance of the Loggly Transport": {
        "when passed an input token": {
            "should have the proper methods defined": function () {
                assertLoggly(tokenTransport);
            },
            "the log() method": helpers.testNpmLevels(tokenTransport, "should log messages to GLC", function (ign, err, logged) {
                assert.isNull(err);
                assert.isTrue(logged);
            })
        }
    }
}).export(module);
