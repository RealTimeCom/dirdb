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
All async method functions returns the object they belong (`db` core, or `db.client()` stream).
```js
obj. // < can be: db or db.client() stream
methodAsync(..., (...) => { ... }). // and so on...
methodAsync(..., (...) => { ... });
// ASYNC call example
db. // < can be: db or db.client() stream, see below
put(dirname, key, value1, e => {}). // and so on...
add(dirname, key, value2, e => {});
```
### `isdir(dirname)`
If `dirname` exist, return/callback object `dirconfig`, or `undefined` if not.
* `dirname` - String directory table name (folder), without slashes, e.g. `name`
```js
// SYNC
const dirconfig = db.isdir(dirname);
// ASYNC
db.isdir(dirname, dirconfig => { });
```
### `mkdir(dirname[, options])`
Make a directory by name, not path, e.g. `name`. If `dirname` exist, throw/callback `error`. Return/callback `name` on success. For more `options`, see below.
```js
// SYNC
const name = db.mkdir(dirname);
// ASYNC
db.mkdir(dirname, (error, name) => {
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
const dbconfig = db.list();
// ASYNC
db.list(dbconfig => { });
```
### `put(dirname, key, value[, callback])`
Throw/callback `error` if key exists. Return/callback `{ uid, hash, path }` if success.
* `dirname` - String directory table name, without slashes
* `key` - String|Buffer
* `value` - String|Buffer

Return `{ uid, hash, path }`
* `uid` - String unique id ( birthDateInt36.Index )
* `hash` - String key hash ( using: `dirconfig` algorithm + digest )
* `path` - String path key ( file `path.k` ) and value ( file `path.v` )
```js
// SYNC
const { uid, hash, path } = db.put(dirname, key, value);
// ASYNC
db.put(dirname, key, value, (error, uid, hash, path) => {
    if (error) { throw error; }
});
```
### `set(dirname, key, value[, callback])`
Overwrite value if key exists, or create, if not. Return/callback `{ uid, hash, path }` if success.
```js
// SYNC
const { uid, hash, path } = db.set(dirname, key, value);
// ASYNC
db.set(dirname, key, value, (error, uid, hash, path) => {
    if (error) { throw error; }
});
```
### `add(dirname, key, value[, callback])`
Append `value` if key exists, or create, if not. Return/callback `{ uid, hash, path }` if success.
```js
// SYNC
const { uid, hash, path } = db.add(dirname, key, value);
// ASYNC
db.add(dirname, key, value, (error, uid, hash, path) => {
    if (error) { throw error; }
});
```
### `get(dirname, key[, callback])`
Read key `value`. Throw/callback `error` if key not exists. Return/callback `{ value, uid, hash, path }` if success.
```js
// SYNC
const { value, uid, hash, path } = db.get(dirname, key); // value is Buffer
// ASYNC
db.get(dirname, key, (error, value, uid, hash, path) => { // value is Buffer or undefined if error
    if (error) { throw error; }
});
```
### `del(dirname, key[, callback])`
Delete `key`. Throw/callback `error` if key not exists. Return/callback `uid` if success.
```js
// SYNC
const uid = db.del(dirname, key);
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
const keylistA = db.keys(dirname); // without range select, return all
const keylistB = db.keys(dirname, { start: 1 }); // without end point, return all except first key ( index: 1, 2, ... )
const keylistC = db.keys(dirname, { start: 0, end: 2 }); // return first two keys ( index: 0 and 1 )
// ASYNC
db.keys(dirname, (error, keylist) => { // without range select, return all
    if (error) { throw error; }
});
// without start point, return first two keys ( index: 0 and 1 )
db.keys(dirname, { end: 2 }, (error, keylist) => { // keylist is Object or undefined if error
    if (error) { throw error; }
});
```
### `val(dirname, uid, keyhash[, callback])`
Throw/callback `error` if key not exists. Return/callback `{ key, value, path }` if success. See the above `keylist` object for `uid` and `keyhash`.
```js
// SYNC
const { key, value, path } = db.val(dirname, uid, keyhash); // key and value is Buffer
// ASYNC
db.val(dirname, uid, keyhash, (error, key, value, path) => { // key and value is Buffer or undefined if error
    if (error) { throw error; }
});
```
### `stats()`
Throw/callback `error` if key not exists. Return/callback `{ uid, hash, path, stats }` if success.
*  `stats` - Object, key value file `lstat` <a href="https://nodejs.org/api/fs.html#fs_class_fs_stats">fs.Stats</a>
```js
// SYNC
const { uid, hash, path, stats } = db.stats(dirname, key);
// ASYNC
db.stats(dirname, key, (error, uid, hash, path, stats) => {
    if (error) { throw error; }
    // fs.Stats file: path + '.v'
    // require('fs').lstat(path + '.v', (error, stats) => {})
    console.log('Birth time', stats.birthtime);
    console.log('Modified time', stats.mtime);
    console.log('Key value size', stats.size);
});
```
### `setgc(dirname, option)`
Set `dirname` GC boolean option. When delete a key using `del()` function, if GC is enabled (true), the directory where the key-value was saved, is deleted if is empty. Throw/callback `error` if dirname not exists. Return/callback `dirconfig` if success.
```js
// SYNC
const dirconfig = db.setgc(dirname, true);
// ASYNC
db.setgc(dirname, false, (error, dirconfig) => { // dirconfig is Object or undefined if error
    if (error) { throw error; }
    console.log('gc', dirconfig.gc);
});
```
### `server()`
Server stream object. See the stream / socket examples below, of how to pipe server stream into client stream.

### `client([sync])`
Client stream object. Server call method functions is sync `false` (by default), for sync set `true`. The sync/async server method can be set individually on any client function, with the last argument.
```js
// call SYNC method functions on server
const clientS = db.client(true);
// call ASYNC method functions on server
const clientA = db.client(); // or false

const client = db.client();
client.set(dirname, key, value, (error, uid) => {
    if (error) { throw error; }
}, true); // true: call SYNC method function on server
client.del(dirname, key, (error, uid) => {
    if (error) { throw error; }
}, false); // false: call ASYNC method function on server
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
net.createServer(socket => socket.pipe(db.server()).pipe(socket)).
listen(function() { // socket server listen to a random port and address
    const a = this.address(); // get the socket server port and address
    net.connect(a.port, a.address, function() {
        const client = db.client(); // default ASYNC methods on DB core
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
High level, means high directory divisor. To increase I/O speed on high number of keys entries, make sure a high level value is defined on `db.mkdir` options. If there is only few key entries on directory, high level value will decrease the I/O speed.
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

### High Availability, Backup and Restore Operations
DirDB is very light and simple database, because of that, HA / Back-Up / Restore can be done with tools like <a href="https://rsync.samba.org"><b>rsync</b></a> or <a href="https://www.cis.upenn.edu/~bcpierce/unison/"><b>unison</b></a>.
```sh
# Backup example
$ rsync -abqz dirA dirB
# High Availability example
$ unison -auto dirA/ dirB/
```
* `dirA` local directory ( primary )
* `dirB` remote / network directory ( secondary )
```js
// High Availability, using unison
const dbA = new dirdb(dirA); // primary DB
// Host A ( local )
net.createServer(socket => socket.pipe(dbA.server()).pipe(socket));
// dirB > ssh://dev@192.168.1.10/home/alice/dirB
// OR
// dirB > socket://remote_host:port_num/path/to/dirB
const dbB = new dirdb(dirB); // secondary DB
// Host B ( remote ) - another node.js server
net.createServer(socket => socket.pipe(dbB.server()).pipe(socket));
```
### DB core only (not client), async stream write/read big values
```js
const fs = require('fs');
// db core, write big value, source file '/path/big/file.ext'
db.put(dirname, key, '', (error, uid, hash, path) => { // or db.set() to overwrite, if key exists
    if (error) { throw error; }
    fs.createReadStream('/path/big/file.ext').pipe(fs.createWriteStream(path + '.v'));
});
// db core, append big value, source file '/path/big/file.ext'
db.add(dirname, key, '', (error, uid, hash, path) => {
    if (error) { throw error; }
    fs.createReadStream('/path/big/file.ext').pipe(fs.createWriteStream(path + '.v', { flags: 'a' }));
});
// db core, read big value
db.stats(dirname, key, (error, uid, hash, path, stats) => {
    if (error) { throw error; }
    fs.createReadStream(path + '.v').on('data', data => {});
});
```

**For more info, consult or run the <a href="https://github.com/RealTimeCom/dirdb/blob/master/test.js"><b>test.js</b></a> file.**

--------------------------------------------------------
**DirDB** is licensed under the MIT license. See the included `LICENSE` file for more details.
