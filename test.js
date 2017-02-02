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
put iyn4swkl.0
get pass iyn4swkl.0
del iyn4swkl.0
*/

// TEST ASYNC
db.put('auth', 'user', 'pass', (e, uid) => {
    console.log('put', e, uid);
    if (!e && uid) {
        db.get('auth', 'user', (e, data, uid) => {
            console.log('get', e, data ? data.toString() : data, uid);
            if (!e && uid) {
                db.del('auth', 'user', (e, uid) => {
                    console.log('del', e, uid);
                    if (!e && uid) { testStream(); } // call next test 'testStream()'
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

// TEST STREAM
function testStream() {
    const client = db.client();
    client.pipe(db.server()).pipe(client);
    client.put('auth', 'user', 'pass', h => {
        console.log('put', h);
        if (!h.error && h.uid) {
            client.get('auth', 'user', (h, b) => {
                console.log('get', h, b.toString());
                if (!h.error && h.uid) {
                    client.del('auth', 'user', h => {
                        console.log('del', h);
                        if (!h.error && h.uid) { testSocket(); } // call next test 'testSocket()'
                    });
                }
            });
        }
    });
}
/** console.log:
---
put { uid: 'iyn4swl0.2' }
get { uid: 'iyn4swl0.2' } pass
del { uid: 'iyn4swl0.2' }
*/

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
            // call some db.client methods, like in stream example, see above
            client.put('auth', 'user', 'pass', h => {
                console.log('put', h);
                if (!h.error && h.uid) {
                    client.get('auth', 'user', (h, b) => {
                        console.log('get', h, b.toString());
                        if (!h.error && h.uid) {
                            client.del('auth', 'user', h => {
                                console.log('del', h);
                                if (!h.error && h.uid) {
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
}
/** console.log:
---
put { uid: 'iyn4swlj.3' }
get { uid: 'iyn4swlj.3' } pass
del { uid: 'iyn4swlj.3' }
rmdir {}
list {}
socket.server close
*/
