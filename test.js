/* TEST FILE - Copyright (c) 2017 dirdb - Tanase Laurentiu Iulian - https://github.com/RealTimeCom/dirdb */
'use strict';

const dirdb = require('./index.js'), fs = require('fs'), sep = require('path').sep;

const root = __dirname + sep + 'test';
fs.mkdirSync(root); // make a test directory

const db = new dirdb(root); // init database

console.log('list', db.list());
if (!db.isdir('auth')) { // verify if dir 'auth' exists
    console.log('mkdir', db.mkdir('auth', { level: 2 }));
    console.log('list', db.list());
}
/** console.log:
---
list {}
mkdir auth
list { auth:
   { level: 2,
     dmode: 448,
     fmode: 384,
     algorithm: 'md5',
     digest: 'base64',
     compress: 'none',
     gc: true } }
*/


// TEST SYNC
console.log('put', db.put('auth', 'user', 'pass')); // throws error if key exists
const { value, uid } = db.get('auth', 'user'); // read key value
console.log('get', value.toString(), uid);
console.log('set', db.set('auth', 'user', 'PA')); // overwrite value if key exists
console.log('add', db.add('auth', 'user', 'SS')); // append value if key exists
console.log('add', db.add('auth', 'user1', 'pass1')); // if key not found, db.add() will create
console.log('set', db.set('auth', 'user2', 'pass2')); // if key not found, db.set() will create
// get the keys list of dir 'auth', with optional range select { start: 0, end: 2 }
const keys = db.keys('auth', { start: 0, end: 3 }); // range is very useful for pagination and not only :)
console.log('keys', keys);
for (let uid of Object.keys(keys)) { // for each key
    const { key, value } = db.val('auth', uid, keys[uid]); // read key-value, using uid-hash
    console.log('val', key.toString(), value.toString());
    // db.set('auth', key, 'newValue'); < overwrite value
    console.log('del', db.del('auth', key)); // key = 'user' (buffer)
}
//db.keys('auth', (e, uid, key) => console.log('key', e, uid, key.toString()));
/** console.log:
---
put iyrsvz8l.0
get pass iyrsvz8l.0
set iyrsvz8l.0
add iyrsvz8l.0
add iyrsvz8o.1
set iyrsvz8o.2
keys { 'iyrsvz8l.0': '7hHLsZBS5AsHqsDKBgwj7g',
  'iyrsvz8o.1': 'JMnhXlKvxHwiW3V@e@4fnQ',
  'iyrsvz8o.2': 'fljWO2AZfOtVocSHmJo3IA' }
val user PASS
del iyrsvz8l.0
val user1 pass1
del iyrsvz8o.1
val user2 pass2
del iyrsvz8o.2
*/

// TEST ASYNC
function test(db, cb) {
    db.put('auth', 'user', 'pass', (e, uid) => { // put, e is defined if key exists
        console.log('put', e, uid);
        if (!e && uid) {
            db.get('auth', 'user', (e, value, uid) => {
                console.log('get', e, value ? value.toString() : value, uid);
                if (!e && uid) {
                    db.set('auth', 'user', 'PA', (e, uid) => { // set, overwrite value if key exists
                        console.log('set', e, uid);
                        if (!e && uid) {
                            db.add('auth', 'user', 'SS', (e, uid) => { // append value if key exists
                                console.log('add', e, uid);
                                if (!e && uid) {
                                    db.keys('auth', { end: 1 }, (e, keys) => { // select first key, range = { end: 1 }
                                        console.log('keys', e, keys);
                                        if (!e && keys) {
                                            const uid = Object.keys(keys)[0]; // read first key from the list
                                            db.val('auth', uid, keys[uid], (e, key, value) => {
                                                console.log('val', e, key.toString(), value.toString());
                                                if (!e) {
                                                    // db.set('auth', key, 'newValue', (e, uid) => { ... }); < overwrite value
                                                    db.del('auth', key, (e, uid) => { // key = 'user' (buffer)
                                                        console.log('del', e, uid);
                                                        if (!e && uid) {
                                                            if (cb) { cb(); } // call next
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
        }
    });
}
test(db, testStream); // core db test
/** console.log:
---
put undefined iyrsvz93.3
get undefined pass iyrsvz93.3
set undefined iyrsvz93.3
add undefined iyrsvz93.3
keys undefined { 'iyrsvz93.3': '7hHLsZBS5AsHqsDKBgwj7g' }
val undefined user PASS
del undefined iyrsvz93.3
*/

// TEST STREAM
function testStream() {
    const client = db.client(false); // false = set default SYNC methods on server
    client.pipe(db.server()).pipe(client);
    test(client, testSocket); // stream test
}
/** console.log:
---
put undefined iyrsvz9p.4
get undefined pass iyrsvz9p.4
set undefined iyrsvz9p.4
add undefined iyrsvz9p.4
keys undefined { 'iyrsvz9p.4': '7hHLsZBS5AsHqsDKBgwj7g' }
val undefined user PASS
del undefined iyrsvz9p.4
*/

function end() {
    this.rmdir('auth', e => { // remove dir 'auth', is safe, server db core sync call
        console.log('rmdir', e);
        this.list(r => { // see the current directory list
            console.log('list', r);
            this.push(null); // optional, end stream db.client 'client'
            this.server.close(); // optional, close socket.server 'client.server'
        });
    });
}
// TEST SOCKET STREAM
function testSocket() {
    const net = require('net');
    const server = db.server();
    const client = db.client(true); // true = set default ASYNC methods on server
    net.createServer(socket => {
        // filter by IPv4: if (socket.remoteAddress !== '127.0.0.1') { return socket.destroy(); }
        socket.pipe(server).pipe(socket); // pipe db.server 'server' into socket.client 'socket'
    }).listen(function() {
        const a = this.address(); // get the socket.server port and address
        client.server = this; // optional, attach socket.server 'this' to the db.client 'client'
        net.connect(a.port, a.address, function() { // connect to socket.server Port 'a.port' and IP 'a.address'
            this.pipe(client).pipe(this); // pipe db.client 'client' into socket.client 'this'
            test(client, end.bind(client)); // socket stream test
        });
    }).once('close', () => console.log('socket.server close'));
}
/** console.log:
---
put undefined iyrsvzac.5
get undefined pass iyrsvzac.5
set undefined iyrsvzac.5
add undefined iyrsvzac.5
keys undefined { 'iyrsvzac.5': '7hHLsZBS5AsHqsDKBgwj7g' }
val undefined user PASS
del undefined iyrsvzac.5
rmdir undefined
list {}
socket.server close
*/
