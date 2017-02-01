## DirDB
[![NPM](https://nodei.co/npm/dirdb.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/dirdb/)

[![Build Status](https://travis-ci.org/RealTimeCom/dirdb.svg?branch=master)](http://travis-ci.org/RealTimeCom/dirdb)
[![dependencies](https://david-dm.org/RealTimeCom/dirdb.svg)](https://david-dm.org/RealTimeCom/dirdb)

**DirDB key-value directory database**
```sh
$ npm install dirdb
```
#### Run tests
Browse module (e.g. `node_modules/dirdb`) install directory, and run tests:
```sh
$ npm test
# or
$ node test.js
```
Compare test results with <a href="https://travis-ci.org/RealTimeCom/dirdb">travis run tests</a>.

#### Include in your script
```js
const db = require('dirdb');
```
#### Define the database root directory `__dirname` (e.g. current directory), make sure the directory exists and have the right user permissions mode.
```js
const db = new dirdb(__dirname); // or full pathname '/root/path/name'
```
#### Make dir `auth`, and verify if not exists
```js
if (!db.isdir('auth')) { // verify if dir 'auth' exists
    db.mkdir('auth'); // make dir 'auth'
}
console.log('list', db.list()); // see the current directory list
/** console.log:
---
list { auth:
   { level: 2,
     dmode: 448,
     fmode: 384,
     algorithm: 'md5',
     digest: 'base64',
     compress: 'none',
     gc: true } }
*/
```
#### SYNC methods example
```js
// dir = 'auth', key = 'user', value = 'pass'
console.log('put', db.put('auth', 'user', 'pass'));
const { data, uuid } = db.get('auth', 'user');
console.log('get', data.toString(), uuid);
console.log('del', db.del('auth', 'user'));
/** console.log:
---
put iyn4swkl.0
get pass iyn4swkl.0
del iyn4swkl.0
*/
```
#### ASYNC methods example
```js
// dir = 'auth', key = 'user', value = 'pass'
db.put('auth', 'user', 'pass', (e, uuid) => {
    console.log('put', e, uuid);
    if (!e && uuid) {
        db.get('auth', 'user', (e, data, uuid) => {
            console.log('get', e, data ? data.toString() : data, uuid);
            if (!e && uuid) {
                db.del('auth', 'user', (e, uuid) => {
                    console.log('del', e, uuid);
                });
            }
        });
    }
});
/** console.log:
---
put undefined iyn4swkp.1
get undefined pass iyn4swkp.1
del undefined iyn4swkp.1
*/
```
#### Stream example
```js
const client = db.client();
client.pipe(db.server()).pipe(client);
// dir = 'auth', key = 'user', value = 'pass'
client.put('auth', 'user', 'pass', h => {
    console.log('put', h);
    if (!h.error && h.uuid) {
        client.get('auth', 'user', (h, b) => {
            console.log('get', h, b.toString());
            if (!h.error && h.uuid) {
                client.del('auth', 'user', h => {
                    console.log('del', h);
                });
            }
        });
    }
});
/** console.log:
---
put { uuid: 'iyn4swl0.2' }
get { uuid: 'iyn4swl0.2' } pass
del { uuid: 'iyn4swl0.2' }
*/
```
#### Socket stream example
```js
const net = require('net');
const server = db.server();
const client = db.client();

net.createServer(socket => {
    socket.pipe(server).pipe(socket); // pipe db.server 'server' into socket.client 'socket'
}).listen(function() {
    const a = this.address(); // get the socket.server port and address
    client.server = this; // optional, attach socket.server 'this' to the db.client 'client'
    net.connect(a.port, a.address, function() { // connect to socket.server Port 'a.port' and IP 'a.address'
        this.pipe(client).pipe(this); // pipe db.client 'client' into socket.client 'this'
        // call some db.client methods, like in stream example, see above
        client.put('auth', 'user', 'pass', h => {
            console.log('put', h);
            if (!h.error && h.uuid) {
                client.get('auth', 'user', (h, b) => {
                    console.log('get', h, b.toString());
                    if (!h.error && h.uuid) {
                        client.del('auth', 'user', h => {
                            console.log('del', h);
                            if (!h.error && h.uuid) {
                                client.rmdir('auth', h => { // remove dir 'auth'
                                    console.log('rmdir', h);
                                    client.list(h => { // see the current directory list
                                        console.log('list', h);
                                        client.push(null); // optional, end stream db.client 'client'
                                        client.server.close(); // optional, close socket.server 'client.server'
                                    });
                                });
                            }
                        });
                    }
                });
            }
        });
    });
}).once('close', () => console.log('socket.server close'));
/** console.log:
---
put { uuid: 'iyn4swlj.3' }
get { uuid: 'iyn4swlj.3' } pass
del { uuid: 'iyn4swlj.3' }
rmdir {}
list {}
socket.server close
*/
```
#### `db.mkdir(name, options)`
* `name` - String directory table name, without any slashes
* `options` - Object, see below

#### Directory table options
* `level` - Number, key hash directory divisor, default `2`, minim `0` and max limited by `algorithm` and `digest` value, see below
* `dmode` - Number, directory mode, default `0o700`
* `fmode` - Number, file mode, default `0o600`
* `algorithm` - String, key hash algorithm, default `md5`, possible: `md5` | `sha1` | `sha256` | `sha512`
* `digest` - String, key hash digest, default `base64`, possible: `base64` | `hex`
* `compress` - String, zlib compress type, default `none`, possible: `none` | `deflate` | `gzip`
* `gc` - Boolean, run garbage collector after key delete, default `true`

You can overwrite the default directory options:
```js
const db = new dirdb('/dir/pathname', {
    level: 3, // overwrite default options
    digest: 'hex',
});
```
#### Make dir options example
High level, means high directory divisor. To increase I/O speed on high number of keys entries, make sure you define a high level value on `db.mkdir` options. But, if the directory will have few key entries, the high level value will decrease the I/O speed.
```js
// dir name 'logs'
db.mkdir('logs', {
    level: 4,
    algorithm: 'sha1',
    digest: 'hex',
    compress: 'gzip'
});
// sha1 = 35 unique characters , level = 4
console.log('divisor', Math.pow(35, 4)); // 1500625
// key entries are stored on 1500625 max sub-directories
```
#### Few examples of how to calculate the directory divisor, at maximum level
* md5-base64   Math.pow(64, 22) - 64 unique characters, 22 long max level
* md5-hex      Math.pow(35, 32) - 35 unique characters, 32 long max level
* sha1-base64  Math.pow(64, 27) - 64 unique characters, 27 long max level
* sha1-hex     Math.pow(35, 40) - 35 unique characters, 40 long max level


**For more info, consult or run the <a href="https://github.com/RealTimeCom/dirdb/blob/master/test.js"><b>test.js</b></a> file.**

--------------------------------------------------------
**DirDB** is licensed under the MIT license. See the included `LICENSE` file for more details.
