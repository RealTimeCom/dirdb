/* SOURCE FILE - Copyright (c) 2017 dirdb - Tanase Laurentiu Iulian - https://github.com/RealTimeCom/dirdb */
'use strict';

const fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    zlib = require('zlib'),
    //snappy = require('snappy'),
    rpc = require('rpc-json'),
    rmdir = require('rm-dir');

function request(resp, head, body) {
    //console.log('request', head, body.toString());
    if ('f' in head && typeof head.f === 'string') {
        switch (head.f) {
            case 'mkdir': this.db.mkdir(head.d, head.o, (e, dir) => resp({ error: e ? e.message : e, dir: dir })); break;
            case 'rmdir': this.db.rmdir(head.d, e => resp({ error: e ? e.message : e })); break;
            case 'put':   this.db.put(head.d, body.slice(0, head.k), body.slice(head.k), (e, uid) => resp({ error: e ? e.message : e, uid: uid })); break;
            case 'get':   this.db.get(head.d, body, (e, data, uid) => resp({ error: e ? e.message : e, uid: uid }, data)); break;
            case 'del':   this.db.del(head.d, body, (e, uid) => resp({ error: e ? e.message : e, uid: uid })); break;
            case 'list':  resp(this.db.c); break;
            case 'isdir': resp(this.db.isdir(head.d)); break;
            default: resp({ error: 'function "' + head.f + '" not found' });
        }
    } else { resp({ error: 'function not found' }); }
}
class client extends rpc.client {
    constructor() { super(); }
}
client.prototype.mkdir = function(dir, opt, resp) {
    this.exec(resp, { f: 'mkdir', d: dir, o: opt });
};
client.prototype.rmdir = function(dir, resp) {
    this.exec(resp, { f: 'rmdir', d: dir });
};
client.prototype.put = function(dir, key, val, resp) {
    key = toBuffer(key);
    this.exec(resp, { f: 'put', d: dir, k: key.length }, Buffer.concat([key, toBuffer(val)]));
};
client.prototype.get = function(dir, key, resp) {
    this.exec(resp, { f: 'get', d: dir }, key);
};
client.prototype.del = function(dir, key, resp) {
    this.exec(resp, { f: 'del', d: dir }, key);
};
client.prototype.list = function(resp) {
    this.exec(resp, { f: 'list' });
};
client.prototype.isdir = function(dir, resp) {
    this.exec(resp, { f: 'list', d: dir });
};

class dirdb {
    constructor(dir, opt) {
        this.s = typeof opt === 'object' ? dirdb.option(opt, dirdb.p) : dirdb.p; // overwrite default dir options
        this.f = '.dirdb.json'; // dir conf file name
        this.i = 0; // unique id
        this.conf(dir); // cache dir config, sync parse this.f files from each base dir
    }
}
dirdb.p = { level: 2, dmode: 0o700, fmode: 0o600, algorithm: 'md5', digest: 'base64', compress: 'none', gc: true }; // default dir options
dirdb.option = function(opt, p) {
    if (typeof opt === 'object') {
        const algorithm = 'algorithm' in opt && typeof opt.algorithm === 'string' && (opt.algorithm === 'md5' || opt.algorithm === 'sha1' || opt.algorithm === 'sha256' || opt.algorithm === 'sha512') ? opt.algorithm : p.algorithm;
        const digest = 'digest' in opt && typeof opt.digest === 'string' && (opt.digest === 'base64' || opt.digest === 'hex') ? opt.digest : p.digest;
        let level = p.level;
        if ('level' in opt) {
            const l = parseInt(opt.level);
            if (l >= 0 && l <= 128) {
                if (algorithm === 'md5') {
                    if (digest === 'base64' && l <= 22) { level = l; }
                    else if (digest === 'hex' && l <= 32) { level = l; }
                } else if (algorithm === 'sha1') {
                    if (digest === 'base64' && l <= 27) { level = l; }
                    else if (digest === 'hex' && l <= 40) { level = l; }
                } else if (algorithm === 'sha256') {
                    if (digest === 'base64' && l <= 43) { level = l; }
                    else if (digest === 'hex' && l <= 64) { level = l; }
                } else if (algorithm === 'sha512') {
                    if (digest === 'base64' && l <= 86) { level = l; }
                    else if (digest === 'hex' && l <= 128) { level = l; }
                }
            }
        }
        return {
            level: level,
            dmode: 'dmode' in opt ? parseInt(opt.dmode) : p.dmode,
            fmode: 'fmode' in opt ? parseInt(opt.fmode) : p.fmode,
            algorithm: algorithm,
            digest: digest,
            compress: 'compress' in opt && typeof opt.compress === 'string' && (opt.compress === 'none' || opt.compress === 'deflate' || opt.compress === 'gzip') ? opt.compress : p.compress, // || opt.compress === 'snappy'
            gc: 'gc' in opt ? Boolean(opt.gc) : p.gc
        };
    } else {
        return p;
    }
};
dirdb.prototype.conf = function(dir) {
    if (typeof dir !== 'string') { throw new Error('invalid dir type "' + (typeof dir) + '", String expected'); }
    dir = path.normalize(dir);
    if (dir === '' || dir === '.' || dir === '..') { throw new Error('invalid dir path name "' + dir + '"'); }
    let c = {},
        s = fs.lstatSync(dir);
    if (!s.isDirectory()) { throw new Error('dir "' + dir + '" is not directory'); } else {
        for (let v of fs.readdirSync(dir)) { // scan each dir
            s = fs.lstatSync(dir + path.sep + v);
            if (s.isDirectory()) {
                s = fs.lstatSync(dir + path.sep + v + path.sep + this.f); // read dir config file
                if (s.isFile() && s.size > 0) {
                    c[v] = dirdb.option(JSON.parse(fs.readFileSync(dir + path.sep + v + path.sep + this.f).toString()), this.s); // parse options
                }
            }
        }
    }
    this.c = c;
    this.d = dir;
};
dirdb.prototype.mkdir = function(dir, opt, cb) { // don't use slashes \ / or dots . in the dir name
    if (typeof opt === 'function' && cb === undefined) { cb = opt; }
    if (typeof cb === 'function') { // async
        if (!(dir = safeDir(dir, cb))) { return; }
        if (dir in this.c) { cb(new Error('dir "' + dir + '" exists')); } else {
            opt = dirdb.option(opt, this.s); // parse options
            fs.mkdir(this.d + path.sep + dir, opt.dmode, e => {
                if (e) { cb(e); } else {
                    fs.writeFile(this.d + path.sep + dir + path.sep + this.f, JSON.stringify(opt), { mode: opt.fmode }, e => {
                        if (e) { cb(e); } else {
                            this.c[dir] = opt;
                            cb(undefined, dir);
                        }
                    });
                }
            });
        }
    } else { // sync
        dir = safeDir(dir);
        if (dir in this.c) { throw new Error('dir "' + dir + '" exists'); }
        opt = dirdb.option(opt, this.s); // parse options
        fs.mkdirSync(this.d + path.sep + dir, opt.dmode);
        fs.writeFileSync(this.d + path.sep + dir + path.sep + this.f, JSON.stringify(opt), { mode: opt.fmode });
        this.c[dir] = opt;
        return dir;
    }
};
dirdb.prototype.rmdir = function(dir, cb) {
    if (typeof cb === 'function') { // async
        if (!(typeof dir === 'string' && dir in this.c)) { cb(new Error('dir "' + dir + '" not found')); } else {
            rmdir(this.d + path.sep + dir, e => {
                if (e) { cb(e); } else {
                    if (dir in this.c) { delete this.c[dir]; } // async delete
                    cb();
                }
            });
        }
    } else { // sync
        if (!(typeof dir === 'string' && dir in this.c)) { throw new Error('dir "' + dir + '" not found'); }
        rmdir(this.d + path.sep + dir);
        delete this.c[dir];
    }
};
function find(d, a, key, cb, r) {
    if (a.length > 0) { // verify if key exists
        const x = path.parse(a[0]);
        if (x.ext === '.k') {
            fs.lstat(d + path.sep + a[0], (e, s) => {
                if (e) { cb(e); } else {
                    if (s.isFile() && s.size === key.length) {
                        fs.readFile(d + path.sep + a[0], (e, b) => {
                            if (e) { cb(e); } else {
                                if (key.compare(b) === 0) {
                                    cb(new Error('key exists'), r ? x.name : undefined);
                                } else { find(d, a.splice(0, 1) ? a : a, key, cb, r); }
                            }
                        });
                    } else { find(d, a.splice(0, 1) ? a : a, key, cb, r); }
                }
            });
        } else { find(d, a.splice(0, 1) ? a : a, key, cb, r); }
    } else { cb(); }
}
dirdb.prototype.uid = function() {
    if (this.i === 1e9) { this.i = 0; } // max id, reset
    return new Date().getTime().toString(36) + '.' + (this.i++).toString(36); // parseInt(uid.split('.')[0], 36) - birthtime
};
dirdb.prototype.put = function(dir, key, val, cb) {
    if (typeof cb === 'function') { // async
        if (!(typeof dir === 'string' && dir in this.c)) { cb(new Error('dir "' + dir + '" not found')); } else {
            key = toBuffer(key);
            if (key.length === 0) { cb(new Error('empty key')); } else {
                const p = xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
                make(this.d + path.sep + dir, p, this.c[dir].dmode, e => {
                    if (e) { cb(e); } else {
                        const d = this.d + path.sep + dir + path.sep + p;
                        fs.readdir(d, (e, a) => {
                            if (e) { cb(e); } else {
                                find(d, a, key, e => { // verify if key exists
                                    if (e) { cb(e); } else {
                                        const uid = this.uid();
                                        compress(toBuffer(val), this.c[dir].compress, (e, b) => {
                                            if (e) { cb(e); } else {
                                                fs.writeFile(d + path.sep + uid + '.v', b, { mode: this.c[dir].fmode }, e => {
                                                    if (e) { cb(e); } else {
                                                        fs.writeFile(d + path.sep + uid + '.k', key, { mode: this.c[dir].fmode }, e => {
                                                            if (e) { cb(e); } else { cb(undefined, uid); }
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
        }
    } else { // sync
        if (!(typeof dir === 'string' && dir in this.c)) { throw new Error('dir "' + dir + '" not found'); }
        key = toBuffer(key);
        if (key.length === 0) { throw new Error('empty key'); }
        const p = xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
        make(this.d + path.sep + dir, p, this.c[dir].dmode);
        const d = this.d + path.sep + dir + path.sep + p;
        let s;
        for (let v of fs.readdirSync(d)) { // verify if key exists
            if (path.parse(v).ext === '.k') {
                s = fs.lstatSync(d + path.sep + v);
                if (s.isFile() && s.size === key.length && key.compare(fs.readFileSync(d + path.sep + v)) === 0) { throw new Error('key exists'); }
            }
        }
        const uid = this.uid();
        fs.writeFileSync(d + path.sep + uid + '.v', compress(toBuffer(val), this.c[dir].compress), { mode: this.c[dir].fmode });
        fs.writeFileSync(d + path.sep + uid + '.k', key, { mode: this.c[dir].fmode });
        return uid;
    }
};
dirdb.prototype.get = function(dir, key, cb) {
    if (typeof cb === 'function') { // async
        if (!(typeof dir === 'string' && dir in this.c)) { cb(new Error('dir "' + dir + '" not found')); } else {
            key = toBuffer(key);
            if (key.length === 0) { cb(new Error('empty key')); } else {
                const d = this.d + path.sep + dir + path.sep + xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
                fs.readdir(d, (e, a) => {
                    if (e) { cb(e); } else {
                        find(d, a, key, (e, uid) => { // verify if key exists
                            if (e) {
                                if (e.message === 'key exists' && uid) {
                                    fs.readFile(d + path.sep + uid + '.v', (e, data) => {
                                        if (e) { cb(e); } else {
                                            uncompress(data, this.c[dir].compress, (e, b) => {
                                                if (e) { cb(e); } else { cb(undefined, b, uid); }
                                            });
                                        }
                                    });
                                } else { cb(e); }
                            } else { cb(new Error('key not found')); }
                        }, true);
                    }
                });
            }
        }
    } else { // sync
        if (!(typeof dir === 'string' && dir in this.c)) { throw new Error('dir "' + dir + '" not found'); }
        key = toBuffer(key);
        if (key.length === 0) { throw new Error('empty key'); }
        const d = this.d + path.sep + dir + path.sep + xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
        let s, x;
        for (let v of fs.readdirSync(d)) { // verify if key exists
            x = path.parse(v);
            if (x.ext === '.k') {
                s = fs.lstatSync(d + path.sep + v);
                if (s.isFile() && s.size === key.length && key.compare(fs.readFileSync(d + path.sep + v)) === 0) {
                    return { data: uncompress(fs.readFileSync(d + path.sep + x.name + '.v'), this.c[dir].compress), uid: x.name };
                }
            }
        }
        throw new Error('key not found');
    }
};
dirdb.prototype.del = function(dir, key, cb) {
    if (typeof cb === 'function') { // async
        if (!(typeof dir === 'string' && dir in this.c)) { cb(new Error('dir "' + dir + '" not found')); } else {
            key = toBuffer(key);
            if (key.length === 0) { cb(new Error('empty key')); } else {
                const d = this.d + path.sep + dir + path.sep + xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
                fs.readdir(d, (e, a) => {
                    if (e) { cb(e); } else {
                        find(d, a, key, (e, uid) => { // verify if key exists
                            if (e) {
                                if (e.message === 'key exists' && uid) {
                                    fs.unlink(d + path.sep + uid + '.k', e => {
                                        if (e) { cb(e); } else {
                                            fs.unlink(d + path.sep + uid + '.v', e => {
                                                if (e) { cb(e); } else { // run GC, delete last dir
                                                    if (this.c[dir].gc) { fs.rmdir(d, e => cb(undefined, uid)); } else { cb(undefined, uid); }
                                                }
                                            });
                                        }
                                    });
                                } else { cb(e); }
                            } else { cb(new Error('key not found')); }
                        }, true);
                    }
                });
            }
        }
    } else { // sync
        if (!(typeof dir === 'string' && dir in this.c)) { throw new Error('dir "' + dir + '" not found'); }
        key = toBuffer(key);
        if (key.length === 0) { throw new Error('empty key'); }
        const d = this.d + path.sep + dir + path.sep + xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
        let s, x;
        for (let v of fs.readdirSync(d)) { // verify if key exists
            x = path.parse(v);
            if (x.ext === '.k') {
                s = fs.lstatSync(d + path.sep + v);
                if (s.isFile() && s.size === key.length && key.compare(fs.readFileSync(d + path.sep + v)) === 0) {
                    fs.unlinkSync(d + path.sep + v);
                    fs.unlinkSync(d + path.sep + x.name + '.v');
                    if (this.c[dir].gc) { try { fs.rmdirSync(d); } catch (e) { } } // run GC, delete last dir
                    return x.name;
                }
            }
        }
        throw new Error('key not found');
    }
};
dirdb.prototype.list = function() { return this.c; };
dirdb.prototype.isdir = function(dir) { return typeof dir === 'string' && dir in this.c ? this.c[dir] : undefined; };

class server extends rpc.server {
    constructor(db) {
        super(request);
        this.db = db;
    }
}
dirdb.prototype.server = function() { return new server(this); };
dirdb.prototype.client = function() { return new client; };

// cache common values
const empty = Buffer.allocUnsafeSlow(0);

function safeDir(dir, cb) {
    const t = (typeof cb === 'function');
    if (typeof dir !== 'string') {
        const e = 'invalid dir value type "' + (typeof dir) + '", String expected';
        if (t) { cb(e); return false; }
        else { throw new Error(e); }
    }
    dir = path.parse(dir).name;
    if (dir === '' || dir === '.' || dir === '..') {
        const e = 'invalid dir name "' + dir + '"';
        if (t) { cb(e); return false; }
        else { throw new Error(e); }
    }
    return dir;
}
function toBuffer(v) {
    if (v === undefined) { return empty; }
    if (!Buffer.isBuffer(v)) { return typeof v === 'string' ? Buffer.from(v) : Buffer.from(v + ''); }
    return v;
}

String.prototype.safe64 = function() {
    if (this.substr(-1) === '=') { return this.substr(0, this.length - 1).safe64(); }
    return this.replace(/(\/)|(\+)/g, s => { return s === '+' ? '@' : '$'; });
};
function hash(s, h, d) { // safe sync, non-blocking (no I/O) call
    return d === 'base64' ? crypto.createHash(h).update(s).digest(d).safe64() : crypto.createHash(h).update(s).digest(d);
}
function xpath(p, l) { // xpath(hash, level)
    const j = p.length;
    let r = [],
        i = 0;
    for (; i < l; i++) { // for each hash character
        if (i < j) { r.push(p[i]); } else { break; }
    }
    if (i < j) { r.push(p.substring(i)); } // add characters left
    return r.join(path.sep);
}
function make(b, p, m, cb) { // make(dirdb.d + path.sep + dir, xpath(hash, level), dirdb.p.dmode) - sync , for async - add 'cb' callback function
    const i = p.indexOf(path.sep);
    if (i > 0) { // loop
        b += path.sep + p.substring(0, i);
        if (typeof cb === 'function') { // async
            fs.mkdir(b, m, e => {
                if (e && e.code !== 'EEXIST') { cb(e); } else { make(b, p.substring(i + 1), m, cb); }
            });
        } else { // sync
            try {
                fs.mkdirSync(b, m);
                make(b, p.substring(i + 1), m);
            } catch (e) {
                if (e.code !== 'EEXIST') { throw e; } else { make(b, p.substring(i + 1), m); }
            }
        }
    } else { // final
        if (typeof cb === 'function') { // async
            fs.mkdir(b + path.sep + p, m, e => {
                if (e && e.code !== 'EEXIST') { cb(e); } else { cb(); }
            });
        } else { // sync
            try {
                fs.mkdirSync(b + path.sep + p, m);
            } catch (e) {
                if (e.code !== 'EEXIST') { throw e; }
            }
        }
    }
}
function compress(data, type, cb) {
    if (typeof cb === 'function') { // async
        switch (type) {
            case 'deflate': zlib.deflate(data, (e, b) => cb(e, b)); break;
            case 'gzip':    zlib.gzip(data, (e, b) => cb(e, b)); break;
            // case 'snappy':  snappy.compress(data, (e, b) => cb(e, b)); break;
            case 'none':    cb(undefined, data); break;
            default: cb(new Error('invalid compress type'));
        }
    } else { // sync
        switch (type) {
            case 'deflate': return zlib.deflateSync(data);
            case 'gzip':    return zlib.gzipSync(data);
            // case 'snappy':  return snappy.compressSync(data);
            case 'none':    return data;
            default: throw new Error('invalid compress type');
        }
    }
}
function uncompress(data, type, cb) {
    if (typeof cb === 'function') { // async
        switch (type) {
            case 'deflate': zlib.inflate(data, (e, b) => cb(e, b)); break;
            case 'gzip':    zlib.gunzip(data, (e, b) => cb(e, b)); break;
            // case 'snappy':  snappy.uncompress(data, (e, b) => cb(e, b)); break;
            case 'none':    cb(undefined, data); break;
            default: cb(new Error('invalid uncompress type'));
        }
    } else { // sync
        switch (type) {
            case 'deflate': return zlib.inflateSync(data);
            case 'gzip':    return zlib.gunzipSync(data);
            // case 'snappy':  return snappy.uncompressSync(data);
            case 'none':    return data;
            default: throw new Error('invalid uncompress type');
        }
    }
}

module.exports = dirdb;
