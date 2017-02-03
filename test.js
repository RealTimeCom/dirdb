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
const { value, uid } = db.get('auth', 'user');
console.log('get', value.toString(), uid);
console.log('set', db.set('auth', 'user', 'PA')); // overwrite value if key exists
console.log('add', db.add('auth', 'user', 'SS')); // append value if key exists
const keys = db.keys('auth'); // get the keys list of dir 'auth'
console.log('keys', keys);//, { start: 1, end: 3 }
for (let uid of Object.keys(keys)) { // for each key
    const { key, value } = db.val('auth', uid, keys[uid]);
    console.log('val', key.toString(), value.toString());
    // db.set('auth', key, 'newValue'); < overwrite value
    console.log('del', db.del('auth', key)); // key = 'user' (buffer)
}
//db.keys('auth', (e, uid, key) => console.log('key', e, uid, key.toString()));
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

// TEST ASYNC
function async(db, t, cb) {
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
                                    if (t) { // is stream, get keys list is safe, server db core sync call
                                        db.keys('auth', (e, keys) => {
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
                                    } else { // is db core, async db.keys() is unsafe here, muliple random call backs
                                        db.del('auth', 'user', (e, uid) => {
                                            console.log('del', e, uid);
                                            if (!e && uid) {
                                                if (cb) { cb(); } // call next
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}
async(db, false, testStream); // core db test
/** console.log:
---
put undefined iyq1fejz.1
get undefined pass iyq1fejz.1
set undefined iyq1fejz.1
add undefined iyq1fejz.1
del undefined iyq1fejz.1
*/

// TEST STREAM
function testStream() {
    const client = db.client();
    client.pipe(db.server()).pipe(client);
    async(client, true, testSocket); // stream test
}
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
    const client = db.client();
    net.createServer(socket => {
        // filter by IPv4: if (socket.remoteAddress !== '127.0.0.1') { return socket.destroy(); }
        socket.pipe(server).pipe(socket); // pipe db.server 'server' into socket.client 'socket'
    }).listen(function() {
        const a = this.address(); // get the socket.server port and address
        client.server = this; // optional, attach socket.server 'this' to the db.client 'client'
        net.connect(a.port, a.address, function() { // connect to socket.server Port 'a.port' and IP 'a.address'
            this.pipe(client).pipe(this); // pipe db.client 'client' into socket.client 'this'
            async(client, true, end.bind(client)); // socket stream test
        });
    }).once('close', () => console.log('socket.server close'));
}
/** console.log:
---
put undefined iyq1fekx.3
get undefined pass iyq1fekx.3
set undefined iyq1fekx.3
add undefined iyq1fekx.3
keys undefined { 'iyq1fekx.3': '7hHLsZBS5AsHqsDKBgwj7g' }
val undefined user PASS
del undefined iyq1fekx.3
rmdir undefined
list {}
*/
