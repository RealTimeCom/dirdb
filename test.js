/* TEST FILE - Copyright (c) 2017 dirdb - Tanase Laurentiu Iulian - https://github.com/RealTimeCom/dirdb */
'use strict';

const dirdb = require('./index.js'), fs = require('fs'), sep = require('path').sep;

const root = __dirname + sep + 'test';
fs.mkdirSync(root); // make a test directory

const db = new dirdb(root); // init database

console.log('list', db.list());
if (!db.isdir('auth')) { // verify if dir 'auth' exists
    console.log('mkdir', db.mkdir('auth', { level: 0 }));
    console.log('list', db.list());
}
/** console.log:
---
list {}
mkdir auth
list { auth:
   { level: 0,
     dmode: 448,
     fmode: 384,
     algorithm: 'md5',
     digest: 'base64',
     compress: 'none',
     gc: true } }
*/

// TEST SYNC
console.log('put', db.put('auth', 'user', 'pass'));
const { data, uid } = db.get('auth', 'user');
console.log('get', data.toString(), uid);
console.log('keys', db.keys('auth'));//, { start: 1, end: 3 }
//db.keys('auth', (e, uid, key) => console.log('key', e, uid, key.toString()));
console.log('del', db.del('auth', 'user'));
/** console.log:
---
put iyowubce.0
get pass iyowubce.0
keys { 'iyowubce.0': <Buffer 75 73 65 72> }
del iyowubce.0
*/

// TEST ASYNC
function async(db, t, cb) {
    db.put('auth', 'user', 'pass', (e, uid) => {
        console.log('put', e, uid);
        if (!e && uid) {
            db.get('auth', 'user', (e, data, uid) => {
                console.log('get', e, data ? data.toString() : data, uid);
                if (!e && uid) {
                    if (t) { // is stream, get keys list is safe, server db core sync call
                        db.keys('auth', (e, keys) => {
                            console.log('keys', e, keys);
                            if (!e && keys) {
                                db.del('auth', 'user', (e, uid) => {
                                    console.log('del', e, uid);
                                    if (!e && uid) {
                                        if (cb) { cb(); } // call next
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
async(db, false, testStream); // core db test
/** console.log:
---
put undefined iyogfmol.1
get undefined pass iyogfmol.1
del undefined iyogfmol.1
*/

// TEST STREAM
function testStream() {
    const client = db.client();
    client.pipe(db.server()).pipe(client);
    async(client, true, testSocket); // stream test
}
/** console.log:
---
put undefined iyoy94dt.2
get undefined pass iyoy94dt.2
keys undefined { 'iyoy94dt.2': { type: 'Buffer', data: [ 117, 115, 101, 114 ] } }
del undefined iyoy94dt.2
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
put undefined iyoy94ea.3
get undefined pass iyoy94ea.3
keys undefined { 'iyoy94ea.3': { type: 'Buffer', data: [ 117, 115, 101, 114 ] } }
del undefined iyoy94ea.3
rmdir undefined
list {}
socket.server close
*/
