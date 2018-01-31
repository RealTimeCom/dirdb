/* TEST FILE - Copyright (c) 2018 dirdb - Tanase Laurentiu Iulian - https://github.com/RealTimeCom/dirdb */
'use strict';

const dirdb = require('./index.js');

const db = new dirdb('D:/DB', { gc: false }); // sync scan

/*
db.mkdir('test4', { level: 4 }).
then(r => {
    console.log('mkdir', r);
    return db.list();
}).
then(r => {
    console.log('list>>', r);
}).
catch(e => { console.error('e>>', e); });
*/


const server = dirdb.server(db);
const client = dirdb.client();

server.on('serverError', e => console.log('onServerError', e));
client.on('clientError', e => console.log('onClientError', e));

client.pipe(server).pipe(client);

client.rmdir('test2').
then(r => {
    console.log('rmdir', r);
    return client.list();
}).
then(r => {
    console.log('list>>', r);
}).
catch(e => { console.error('e>>', e); });


/* file: server.js
const net = require('net');
net.createServer(socket => {
        console.log('client connected on server');
        socket.on('error', e => { console.log('client connection error', e); }).
        socket.on('end', () => { console.log('client disconnected from server'); });
        const server = dirdb.server(db); // create new server object here for data flow reset
        server.on('serverError', e => console.log('onServerError', e));
        socket.pipe(server).pipe(socket);
}).listen(8080, '127.0.0.1', function() {
    const a = this.address();
    console.log('server listen', a.port, a.address);
}).on('close', () => console.log('server close'));
*/

/* file: client.js
const net = require('net');
net.connect(8080, '127.0.0.1', function() {
    console.log('client connected to server');
    const client = dirdb.client(); // create new client object here for data flow reset
    client.on('clientError', e => console.log('onClientError', e));
    this.pipe(client).pipe(this);
    client.mkdir('test3', { level: 3 }).
    then(r => {
        console.log('r>>', r);
    }).
    catch(e => { console.log('e>>', e); });
}).
on('error', e => { console.log('connection error', e); }).
on('end', () => { console.log('disconnected from server'); });
*/

/*
const root = __dirname + require('path').sep + 'test'; // test directory
try { require('fs').mkdirSync(root); } catch (e) { } // make

const db = new dirdb(root); // init database

console.log('list', db.list());
if (!db.isdir('auth')) { // verify if dir 'auth' exists
    console.log('mkdir', db.mkdir('auth', { level: 2 }));
    console.log('list', db.list());
}
console.log('setgc', db.setgc('auth', false));

// TEST SYNC
console.log('put', db.put('auth', 'user', 'pass')); // throws error if key exists
const { value, uid } = db.get('auth', 'user'); // read key value
console.log('get', value.toString(), uid);
console.log('set', db.set('auth', 'user', 'PA')); // overwrite value if key exists
console.log('add', db.add('auth', 'user', 'SS')); // append value if key exists
console.log('add', db.add('auth', 'user1', 'pass1')); // if key not found, db.add() will create
console.log('set', db.set('auth', 'user2', 'pass2')); // if key not found, db.set() will create
console.log('stats', db.stats('auth', 'user2')); // key value file fs.Stats
// get the keys list of dir 'auth', with optional range select { start: 0, end: 3 }
const keys = db.keys('auth', { start: 0, end: 3 }); // range is very useful for pagination and not only :)
console.log('keys', keys);
for (let uid of Object.keys(keys)) { // for each key
    const { key, value } = db.val('auth', uid, keys[uid]); // read key-value, using uid-hash
    console.log('val', key.toString(), value.toString());
    // db.set('auth', key, 'newValue'); < overwrite value
    console.log('del', db.del('auth', key)); // key = 'user' (buffer)
}

// TEST ASYNC, those callbacks are MUCH faster and compact than async/await or Promise ;)
function test(db, cb) {
    db.put('auth', 'user', 'pass', (e, uid, hash, path) => { // put, e is defined if key exists


    db.put('auth', 'user', 'pass', (e, uid, hash, path) => { // put, e is defined if key exists
        console.log('put', e, uid, hash, path);
        if (!e && uid) {
            db.get('auth', 'user', (e, value, uid, hash, path) => {
                console.log('get', e, value.toString(), uid, hash, path);
                if (!e && uid) {
                    db.set('auth', 'user', 'PA', (e, uid, hash, path) => { // set, overwrite value if key exists
                        console.log('set', e, uid, hash, path);
                        if (!e && uid) {
                            db.add('auth', 'user', 'SS', (e, uid, hash, path) => { // append value if key exists
                                console.log('add', e, uid, hash, path);
                                if (!e && uid) {
                                    db.stats('auth', 'user', (e, uid, hash, path, stats) => { // key value file fs.Stats
                                        console.log('stats', e, uid, hash, path, stats);
                                        if (!e && uid) {
                                            db.keys('auth', { end: 1 }, (e, keys) => { // select first key, range = { end: 1 }
                                                console.log('keys', e, keys);
                                                if (!e && keys) {
                                                    const uid = Object.keys(keys)[0]; // read first key from the list
                                                    db.val('auth', uid, keys[uid], (e, key, value, path) => {
                                                        console.log('val', e, key.toString(), value.toString(), path);
                                                        if (!e) {
                                                            // db.set('auth', key, 'newValue', (e, uid) => {}); < overwrite value
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
    });

}
test(db, testStream); // core db test

// TEST STREAM
function testStream() {
    const client = db.client(true); // optional, true: set default SYNC methods on server
    client.pipe(db.server()).pipe(client);
    test(client, testSocket); // stream test
}

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
    net.createServer(socket => {
        // filter by IPv4: if (socket.remoteAddress !== '127.0.0.1') { return socket.destroy(); }
        socket.pipe(db.server()).pipe(socket); // pipe db.server 'server' into socket.client 'socket'
    }).listen(function() {
        const a = this.address(); // get the socket.server port and address
        const client = db.client(); // default (false) ASYNC methods on DB core
        client.server = this; // optional, attach socket.server 'this' to the db.client 'client'
        net.connect(a.port, a.address, function() { // connect to socket.server Port 'a.port' and IP 'a.address'
            this.pipe(client).pipe(this); // pipe db.client 'client' into socket.client 'this'
            test(client, end.bind(client)); // socket stream test
        });
    }).once('close', () => console.log('socket.server close'));
}
*/