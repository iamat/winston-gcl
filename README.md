# winston-gcl

A [Google Cloud Logging][0] transport for [winston][1].

## Usage
``` js
  var winston = require('winston');

  //
  // Requiring `winston-gcl` will expose
  // `winston.transports.GCL`
  //
  require('winston-gcl');

  winston.add(winston.transports.GCL, options);
```

The Google Cloud Logging transport is started of as a fork of the [winston-loggly][2] transport.

* __level:__ Level of messages that this transport should log.
* __auth:__ *[optional]* The authentication with an google-auth-library instance. If not given, the transport tries to query the google metadata service in order to extract a valid service account.
* __projectId:__ Your Google Cloud Project ID
* __logId:__ Log name

## Installation

### Installing npm (node package manager)

``` bash
  $ curl http://npmjs.org/install.sh | sh
```

### Installing winston-gcl

``` bash
  $ npm install winston
  $ npm install winston-gcl
```

## Run Tests - TODO
All of the winston tests are written in [vows][6], and cover all of the use cases described above. You will need to add valid credentials for the various transports included to test/config.json before running tests:

```
Once you have valid configuration and credentials you can run tests with [npm][7]:

```
  npm test
```

#### Author: [Lars Jacbo](https://github.com/jaclar)
#### License: MIT

[0]: https://cloud.google.com/logging/docs/
[1]: https://github.com/winstonjs/winston
[2]: https://github.com/winstonjs/winston-loggly
