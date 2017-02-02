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
console.log('del', db.del('auth', 'user'));
/** console.log:
---
put iyogfmoi.0
get pass iyogfmoi.0
del iyogfmoi.0
*/

// TEST ASYNC
function async(db, cb) {
    db.put('auth', 'user', 'pass', (e, uid) => {
        console.log('put', e, uid);
        if (!e && uid) {
            db.get('auth', 'user', (e, data, uid) => {
                console.log('get', e, data ? data.toString() : data, uid);
                if (!e && uid) {
                    db.del('auth', 'user', (e, uid) => {
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
async(db, testStream); // core db test
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
    async(client, testSocket); // stream test
}
/** console.log:
---
put undefined iyogfmou.2
get undefined pass iyogfmou.2
del undefined iyogfmou.2
*/

function end() {
    this.rmdir('auth', e => { // remove dir 'auth'
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
            async(client, end.bind(client)); // socket stream test
        });
    }).once('close', () => console.log('socket.server close'));
}
/** console.log:
---
put undefined iyogfmp8.3
get undefined pass iyogfmp8.3
del undefined iyogfmp8.3
rmdir undefined
list {}
socket.server close
*/
