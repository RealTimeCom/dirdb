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
First time, make sure the directory exists, is empty, and have the right user permissions mode.
```js
const db = new dirdb('/dir/path/name');
```
### Chain calls
All async method functions return the object they belong (`db`, `db.server` or `db.client`).
```js
obj. // can be: db, db.server or db.client
methodAsync(..., (...) => { ... }). // and so on...
methodAsync(..., (...) => { ... });
```
### `isdir(dirname)`
If `dirname` exist, return/callback object `dirconfig`, or `undefined` if not.
* `dirname` - String directory table name, without slashes
```js
// SYNC
db.isdir(dirname);
// ASYNC
db.isdir(dirname, dirconfig => { });
```
### `mkdir(dirname[, options])`
Make dir name, if `dirname` exist, return/callback `dirname`, or throw/callback `error` if not. For more `options`, see below.
```js
// SYNC
db.mkdir(dirname);
// ASYNC
db.mkdir(dirname, (error, dirname) => {
    if (error) { throw error; }
});
```
### `rmdir(dirname)`
Remove dir name and its contents, throw/callback `error` if `dirname` not exists.
```js
// SYNC
db.rmdir(dirname);
// ASYNC
db.rmdir(dirname, error => {
    if (error) { throw error; }
});
```
### `list()`
Return/callback `dbconfig` object `{ dirname: dirconfig, ... }`.
```js
// SYNC
db.list(); // return Object dbconfig
// ASYNC
db.list(dbconfig => { });
```
### `put(dirname, key, value[, callback])`
Throw/callback `error` if key exists. Return/callback `uid` if success.
* `dirname` - String directory table name, without slashes
* `key` - String|Buffer
* `value` - String|Buffer
```js
// SYNC
db.put(dirname, key, value); // return String uid
// ASYNC
db.put(dirname, key, value, (error, uid) => { // uid is String or undefined if error
    if (error) { throw error; }
});
```
### `set(dirname, key, value[, callback])`
Overwrite value if key exists, or create, if not. Return/callback `uid` if success.
```js
// SYNC
db.set(dirname, key, value); // return String uid
// ASYNC
db.set(dirname, key, value, (error, uid) => { // uid is String or undefined if error
    if (error) { throw error; }
});
```
### `add(dirname, key, value[, callback])`
Append `value` if key exists, or create, if not. Return/callback `uid` if success.
```js
// SYNC
db.add(dirname, key, value); // return String uid
// ASYNC
db.add(dirname, key, value, (error, uid) => { // uid is String or undefined if error
    if (error) { throw error; }
});
```
### `get(dirname, key[, callback])`
Read key `value`. Throw/callback `error` if key not exists. Return/callback `value` and `uid` if success.
```js
// SYNC
const { value, uid } = db.get(dirname, key); // value is Buffer and uid is String
// ASYNC
db.get(dirname, key, (error, value, uid) => { // value is Buffer and uid is String or undefined if error
    if (error) { throw error; }
});
```
### `del(dirname, key[, callback])`
Delete `key`. Throw/callback `error` if key not exists. Return/callback `uid` if success.
```js
// SYNC
db.del(dirname, key); // return String uid
// ASYNC
db.del(dirname, key, (error, uid) => { // uid is String or undefined if error
    if (error) { throw error; }
});
```
### `keys(dirname[, range[, callback]])`
Return/callback object `keylist` if success.
* `range` - Object `{ start: Number, end: Number }`
* `keylist` - Object `{ uid: keyhash, ... }`
```js
// SYNC
db.keys(dirname); // without range select, return all
db.keys(dirname, { start: 1 }); // example: without end point, return all except first key ( index: 1, 2, ... )
db.keys(dirname, { start: 0, end: 2 }); // example: return first two keys ( index: 0 and 1 )
// ASYNC
db.keys(dirname, (error, keylist) => { // without range select, return all
    if (error) { throw error; }
});
 // example: without start point, return first two keys ( index: 0 and 1 )
db.keys(dirname, { end: 2 }, (error, keylist) => { // keylist is Object or undefined if error
    if (error) { throw error; }
});
```
### `val(dirname, uid, keyhash[, callback])`
Throw/callback `error` if key not exists. Return/callback `key` and `value` if success. See above `keylist` for `uid` and `keyhash`.
```js
// SYNC
const { key, value } = db.val(dirname, uid, keyhash); // key and value is Buffer
// ASYNC
db.val(dirname, uid, keyhash, (error, key, value) => { // key and value is Buffer or undefined if error
    if (error) { throw error; }
});
```
### `server()`
Stream server object.
### `client([async])`
Stream client object. Server call method functions is async `true` (by default), for sync set `false`.
```js
// call SYNC method functions on server
db.client(false);
// call ASYNC method functions on server
db.client();
```
### Stream example
```js
const client = db.client();
client.pipe(db.server()).pipe(client);
client.put(dirname, key, value, (error, uid) => {
    if (error) { throw error; }
});
```
### Socket stream example
```js
const net = require('net');
const server = db.server();
const client = db.client();
net.createServer(socket => {
    socket.pipe(server).pipe(socket);
}).listen(function() { // socket server listen to a random port and address
    const a = this.address(); // get the socket server port and address
    net.connect(a.port, a.address, function() {
        this.pipe(client).pipe(this);
        client.set(dirname, key, value, (error, uid) => {
            if (error) { throw error; }
        });
    });
});
```
### `mkdir(dirname[, options])`
* `dirname` - String directory table name, without slashes
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
### `mkdir()` options example
High level, means high directory divisor. To increase I/O speed on high number of keys entries, make sure a high level value is defined on `db.mkdir` options. If there is only few key entries on directory, the high level value will decrease the I/O speed.
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
