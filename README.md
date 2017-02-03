## DirDB - lightning fast database
[![NPM](https://nodei.co/npm/dirdb.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/dirdb/)

[![Build Status](https://travis-ci.org/RealTimeCom/dirdb.svg?branch=master)](http://travis-ci.org/RealTimeCom/dirdb)
[![dependencies](https://david-dm.org/RealTimeCom/dirdb.svg)](https://david-dm.org/RealTimeCom/dirdb)

[![dirdb](https://cloud.githubusercontent.com/assets/22455434/22533357/50e9c2ae-e8f6-11e6-9dea-4d25aec0fe2e.png)](https://github.com/RealTimeCom/dirdb)

**DirDB key-value directory database**
```sh
$ npm install dirdb
```
### Run tests
Browse module (e.g. `node_modules/dirdb`) install directory, and run tests:
```sh
$ npm test
# or
$ node test.js
```
Compare test results with <a href="https://travis-ci.org/RealTimeCom/dirdb">travis run tests</a>.

### Include in your script
```js
const dirdb = require('dirdb');
```
### Define the database root directory
When first time, make sure the directory exists, is empty, and have the right user permissions mode.
```js
const db = new dirdb('/dir/path/name');
```
### Make dir `auth`, and verify if not exists
```js
if (!db.isdir('auth')) { // verify if dir 'auth' exists
    db.mkdir('auth'); // make dir 'auth'
}
console.log('list', db.list()); // see the current directory list
/** console.log:
---
list { auth:
   { level: 3,
     dmode: 448,
     fmode: 384,
     algorithm: 'md5',
     digest: 'base64',
     compress: 'none',
     gc: true } }
*/
```
### SYNC methods example
```js
// dir = 'auth', key = 'user', value = 'pass'
console.log('put', db.put('auth', 'user', 'pass')); // throws error if key exists
const { value, uid } = db.get('auth', 'user');
console.log('get', value.toString(), uid);
console.log('set', db.set('auth', 'user', 'PA')); // overwrite value if key exists
console.log('add', db.add('auth', 'user', 'SS')); // append value if key exists
const keys = db.keys('auth'); // get the keys list of dir 'auth'
console.log('keys', keys);
for (let uid of Object.keys(keys)) { // for each key
    const { key, value } = db.val('auth', uid, keys[uid]);
    console.log('val', key.toString(), value.toString());
    // db.set('auth', key, 'newValue'); < overwrite value
    console.log('del', db.del('auth', key)); // key = 'user' (buffer)
}
/** console.log:
---
put iyq1fejt.0
get pass iyq1fejt.0
set iyq1fejt.0
add iyq1fejt.0
keys { 'iyq1fejt.0': '7hHLsZBS5AsHqsDKBgwj7g' }
val user PASS
del iyq1fejt.0
*/
```
### ASYNC methods example
```js
// dir = 'auth', key = 'user', value = 'pass'
db.put('auth', 'user', 'pass', (e, uid) => {
    console.log('put', e, uid);
    if (!e && uid) {
        db.get('auth', 'user', (e, value, uid) => {
            console.log('get', e, value ? value.toString() : value, uid);
            if (!e && uid) {
                db.del('auth', 'user', (e, uid) => {
                    console.log('del', e, uid);
                });
            }
        });
    }
});
/** console.log:
---
put undefined iyq1fejz.1
get undefined pass iyq1fejz.1
del undefined iyq1fejz.1
*/
```
### Stream example
```js
const client = db.client();
client.pipe(db.server()).pipe(client);
// dir = 'auth', key = 'user', value = 'pass'
client.put('auth', 'user', 'pass', (e, uid) => {
    console.log('put', e, uid);
    if (!e && uid) {
        client.get('auth', 'user', (e, value, uid) => {
            console.log('get', e, value ? value.toString() : value, uid);
            if (!e && uid) {
                db.set('auth', 'user', 'PA', (e, uid) => { // set, overwrite value if key exists
                    console.log('set', e, uid);
                    if (!e && uid) {
                        db.add('auth', 'user', 'SS', (e, uid) => { // append value if key exists
                            console.log('add', e, uid);
                            if (!e && uid) {
                                db.keys('auth', (e, keys) => { // get key list of dir 'auth'
                                    console.log('keys', e, keys);
                                    if (!e && keys) {
                                        const uid = Object.keys(keys)[0]; // read first key from the list
                                        db.val('auth', uid, keys[uid], (e, key, value) => {
                                            console.log('val', e, key.toString(), value.toString());
                                            if (!e) {
                                                // db.set('auth', key, 'newValue', (e, uid) => { ... }); < overwrite value
                                                client.del('auth', key, (e, uid) => { // key = 'user' (buffer)
                                                    console.log('del', e, uid);
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }
});
/** console.log:
---
put undefined iyq1fekg.2
get undefined pass iyq1fekg.2
set undefined iyq1fekg.2
add undefined iyq1fekg.2
keys undefined { 'iyq1fekg.2': '7hHLsZBS5AsHqsDKBgwj7g' }
val undefined user PASS
del undefined iyq1fekg.2
*/
```
### Socket stream example
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
        client.put('auth', 'user', 'pass', (e, uid) => {
            console.log('put', e, uid);
            if (!e && uid) {
                client.rmdir('auth', e => { // remove dir 'auth'
                    console.log('rmdir', e);
                    client.list(r => { // see the current directory list
                        console.log('list', r);
                        client.push(null); // optional, end stream db.client 'client'
                        client.server.close(); // optional, close socket.server 'client.server'
                    });
                });
            }
        });
    });
}).once('close', () => console.log('socket.server close'));
/** console.log:
---
put undefined iyq1fekx.3
rmdir undefined
list {}
socket.server close
*/
```
### `db.mkdir(name, options)`
* `name` - String directory table name, without slashes
* `options` - Object, see below

### Directory table options
* `level` - Number, key hash directory divisor, default `3`, minim `0` and max limited by `algorithm` and `digest` value, see below
* `dmode` - Number, directory mode, default `0o700`
* `fmode` - Number, file mode, default `0o600`
* `algorithm` - String, key hash algorithm, default `md5`, possible: `md5` | `sha1` | `sha256` | `sha512`
* `digest` - String, key hash digest, default `base64`, possible: `base64` | `hex`
* `compress` - String, zlib compress type, default `none`, possible: `none` | `deflate` | `gzip`
* `gc` - Boolean, run garbage collector after key delete, default `true`

You can overwrite the default directory options:
```js
const db = new dirdb('/dir/pathname', {
    // overwrite default options
    level: 3,
    digest: 'hex',
    gc: false
});
```
### `db.mkdir()` options example
High level, means high directory divisor. To increase I/O speed on high number of keys entries, make sure you define a high level value on `db.mkdir` options. But, if the directory will have few key entries, the high level value will decrease the I/O speed.
```js
// dir name 'logs'
db.mkdir('logs', {
    level: 4,
    algorithm: 'sha1',
    digest: 'hex',
    // WARNING: when use db.add() "append" on compress other than 'none'
    // make sure, the key value will not be corrupted if append function will be used
    compress: 'gzip'
});
// sha1 = 35 unique characters , level = 4
console.log('divisor', Math.pow(35, 4)); // 1500625
// key entries are stored on 1500625 max sub-directories
```
### Few examples of how to calculate the directory divisor, at maximum level
* `md5-base64`   Math.pow(64, 22) - 64 unique characters, 22 long max level
* `md5-hex`      Math.pow(35, 32) - 35 unique characters, 32 long max level
* `sha1-base64`  Math.pow(64, 27) - 64 unique characters, 27 long max level
* `sha1-hex`     Math.pow(35, 40) - 35 unique characters, 40 long max level


**For more info, consult or run the <a href="https://github.com/RealTimeCom/dirdb/blob/master/test.js"><b>test.js</b></a> file.**

--------------------------------------------------------
**DirDB** is licensed under the MIT license. See the included `LICENSE` file for more details.
