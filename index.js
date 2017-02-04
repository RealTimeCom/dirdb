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
    if ('s' in head && typeof head.s === 'boolean' && 'f' in head && typeof head.f === 'string') {
        if (head.s) { // sync
            try {
                switch (head.f) {
                    case 'mkdir':
                    case 'keys': resp({ f: head.f, r: this.db[head.f](head.d, head.o) }); break;
                    case 'put':
                    case 'set':
                    case 'add': resp({ f: head.f, r: this.db[head.f](head.d, body.slice(0, head.k), body.slice(head.k)) }); break;
                    case 'del': resp({ f: head.f, r: this.db.del(head.d, body) }); break;
                    case 'get':
                        const { val, uid } = db.get(head.d, body);
                        resp({ f: head.f, r: uid }, val);
                        break;
                    case 'val':
                        const { key, value } = db.val(head.d, head.u, head.h);
                        resp({ f: head.f, k: key.length }, Buffer.concat([key, value]));
                        break;
                    case 'rmdir': this.db.rmdir(head.d); resp({ f: head.f }); break;
                    case 'list':  resp({ f: head.f, r: this.db.c }); break;
                    case 'isdir': resp({ f: head.f, r: this.db.isdir(head.d) }); break;
                    default: throw new Error('function "' + head.f + '" not found');
                }
            } catch (e) {
                resp({ f: head.f, e: e.message });
            }
        } else { // async
            switch (head.f) {
                case 'mkdir':
                case 'keys': this.db[head.f](head.d, head.o, (e, r) => resp({ f: head.f, e: e ? e.message : undefined, r: e ? undefined : r })); break;
                case 'put':
                case 'set':
                case 'add': this.db[head.f](head.d, body.slice(0, head.k), body.slice(head.k), (e, r) => resp({ f: head.f, e: e ? e.message : undefined, r: e ? undefined : r })); break;
                case 'del': this.db.del(head.d, body, (e, r) => resp({ f: head.f, e: e ? e.message : undefined, r: e ? undefined : r })); break;
                case 'get': this.db.get(head.d, body, (e, value, r) => resp({ f: head.f, e: e ? e.message : undefined, r: e ? undefined : r }, value)); break;
                case 'val':
                    this.db.val(head.d, head.u, head.h, (e, key, value) => {
                        if (e) {
                            resp({ f: head.f, e: e.message });
                        } else {
                            resp({ f: head.f, e: undefined, k: key.length }, Buffer.concat([key, value]));
                        }
                    });
                    break;
                case 'rmdir': this.db.rmdir(head.d, e => resp({ f: head.f, e: e ? e.message : undefined })); break;
                case 'list':  resp({ f: head.f, r: this.db.c }); break;
                case 'isdir': resp({ f: head.f, r: this.db.isdir(head.d) }); break;
                default: resp({ e: 'function "' + head.f + '" not found' });
            }
        }
    } else { resp({ e: 'invalid params' }); }
}
function filter(resp, head, body) {
    if (resp) {
        if ('f' in head && typeof head.f === 'string') {
            switch (head.f) {
                case 'mkdir':
                case 'keys':
                case 'put':
                case 'set':
                case 'add':
                case 'del': resp(head.e, head.r); break;
                case 'get': resp(head.e, body, head.r); break;
                case 'val':
                    if (head.e) { resp(head.e); } else {
                         resp(head.e, body.slice(0, head.k), body.slice(head.k));
                    }
                    break;
                case 'rmdir': resp(head.e); break;
                case 'list':
                case 'isdir': resp(head.r); break;
                default: resp(head.e);
            }
        } else { resp(head.e); }
    }
}
class client extends rpc.client {
    constructor(sync) {
        super(filter);
        this.sync = sync ? true : false;
    }
}
client.prototype.mkdir = function(dir, opt, resp) {
    if (typeof opt === 'function' && resp === undefined) { resp = opt; }
    this.exec(resp, { s: this.sync, f: 'mkdir', d: dir, o: opt });
    return this;
};
client.prototype.rmdir = function(dir, resp) {
    this.exec(resp, { s: this.sync, f: 'rmdir', d: dir });
    return this;
};
client.prototype.put = function(dir, key, val, resp) {
    key = toBuffer(key);
    this.exec(resp, { s: this.sync, f: 'put', d: dir, k: key.length }, Buffer.concat([key, toBuffer(val)]));
    return this;
};
client.prototype.set = function(dir, key, val, resp) {
    key = toBuffer(key);
    this.exec(resp, { s: this.sync, f: 'set', d: dir, k: key.length }, Buffer.concat([key, toBuffer(val)]));
    return this;
};
client.prototype.add = function(dir, key, val, resp) {
    key = toBuffer(key);
    this.exec(resp, { s: this.sync, f: 'add', d: dir, k: key.length }, Buffer.concat([key, toBuffer(val)]));
    return this;
};
client.prototype.get = function(dir, key, resp) {
    this.exec(resp, { s: this.sync, f: 'get', d: dir }, key);
    return this;
};
client.prototype.del = function(dir, key, resp) {
    this.exec(resp, { s: this.sync, f: 'del', d: dir }, key);
    return this;
};
client.prototype.list = function(resp) {
    this.exec(resp, { s: this.sync, f: 'list' });
    return this;
};
client.prototype.isdir = function(dir, resp) {
    this.exec(resp, { s: this.sync, f: 'list', d: dir });
    return this;
};
client.prototype.keys = function(dir, opt, resp) {
    if (typeof opt === 'function' && resp === undefined) { resp = opt; }
    this.exec(resp, { s: this.sync, f: 'keys', d: dir, o: opt });
    return this;
};
client.prototype.val = function(dir, uid, hash, resp) {
    this.exec(resp, { s: this.sync, f: 'val', d: dir, u: uid, h: hash });
    return this;
};

class dirdb {
    constructor(dir, opt) {
        this.s = typeof opt === 'object' ? option(opt, dirdb.p) : dirdb.p; // overwrite default dir options
        this.f = '.dirdb.json'; // dir conf file name
        this.i = 0; // unique id
        this.conf(dir); // cache dir config, sync parse this.f files from each base dir
    }
}
dirdb.p = { level: 3, dmode: 0o700, fmode: 0o600, algorithm: 'md5', digest: 'base64', compress: 'none', gc: true }; // default dir options
function option(opt, p) {
    if (typeof opt === 'object') {
        const algorithm = 'algorithm' in opt && typeof opt.algorithm === 'string' && (opt.algorithm === 'md5' || opt.algorithm === 'sha1' || opt.algorithm === 'sha256' || opt.algorithm === 'sha512') ? opt.algorithm : p.algorithm;
        const digest = 'digest' in opt && typeof opt.digest === 'string' && (opt.digest === 'base64' || opt.digest === 'hex') ? opt.digest : p.digest;
        let level = p.level;
        if ('level' in opt) {
            const l = parseInt(opt.level);
            if (l >= 0 && l < 128) {
                if (algorithm === 'md5') {
                    if (digest === 'base64' && l < 22) { level = l; }
                    else if (digest === 'hex' && l < 32) { level = l; }
                } else if (algorithm === 'sha1') {
                    if (digest === 'base64' && l < 27) { level = l; }
                    else if (digest === 'hex' && l < 40) { level = l; }
                } else if (algorithm === 'sha256') {
                    if (digest === 'base64' && l < 43) { level = l; }
                    else if (digest === 'hex' && l < 64) { level = l; }
                } else if (algorithm === 'sha512') {
                    if (digest === 'base64' && l < 86) { level = l; }
                    else if (digest === 'hex' && l < 128) { level = l; }
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
}
function divisor(c) {
    switch (c.algorithm) {
        case 'md5': return c.digest === 'base64' ? 22 + c.level : 32 + c.level;
        case 'sha1': return c.digest === 'base64' ? 27 + c.level : 40 + c.level;
        case 'sha256': return c.digest === 'base64' ? 43 + c.level : 64 + c.level;
        case 'sha512': return c.digest === 'base64' ? 86 + c.level : 128 + c.level;
    }
    throw new Error('invalid algorithm');
}
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
                    c[v] = option(JSON.parse(fs.readFileSync(dir + path.sep + v + path.sep + this.f).toString()), this.s); // parse options
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
        if (!(dir = safeDir(dir))) { cb(new Error('invalid dir value')); } else {
            if (dir in this.c) { cb(new Error('dir "' + dir + '" exists')); } else {
                opt = option(opt, this.s); // parse options
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
        }
        return this;
    } else { // sync
        if (!(dir = safeDir(dir))) { throw new Error('invalid dir value'); }
        if (dir in this.c) { throw new Error('dir "' + dir + '" exists'); }
        opt = option(opt, this.s); // parse options
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
        return this;
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
        return this;
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
dirdb.prototype.set = function(dir, key, val, cb) {
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
                                find(d, a, key, (e, uid) => { // verify if key exists
                                    if (e) {
                                        if (e.message === 'key exists' && uid) { // key found
                                            compress(toBuffer(val), this.c[dir].compress, (e, b) => {
                                                if (e) { cb(e); } else {
                                                    fs.writeFile(d + path.sep + uid + '.v', b, { mode: this.c[dir].fmode }, e => {
                                                        if (e) { cb(e); } else { cb(undefined, uid); }
                                                    });
                                                }
                                            });
                                        } else { cb(e); }
                                    } else { // key not found
                                        uid = this.uid();
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
                                }, true);
                            }
                        });
                    }
                });
            }
        }
        return this;
    } else { // sync
        if (!(typeof dir === 'string' && dir in this.c)) { throw new Error('dir "' + dir + '" not found'); }
        key = toBuffer(key);
        if (key.length === 0) { throw new Error('empty key'); }
        const p = xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
        make(this.d + path.sep + dir, p, this.c[dir].dmode);
        const d = this.d + path.sep + dir + path.sep + p;
        let s, x, k = false;
        for (let v of fs.readdirSync(d)) { // verify if key exists
            x = path.parse(v);
            if (x.ext === '.k') {
                s = fs.lstatSync(d + path.sep + v);
                if (s.isFile() && s.size === key.length && key.compare(fs.readFileSync(d + path.sep + v)) === 0) { k = true; break; }
            }
        }
        if (k) { // key found
            fs.writeFileSync(d + path.sep + x.name + '.v', compress(toBuffer(val), this.c[dir].compress), { mode: this.c[dir].fmode });
            return x.name;
        } else { // key not found
            const uid = this.uid();
            fs.writeFileSync(d + path.sep + uid + '.v', compress(toBuffer(val), this.c[dir].compress), { mode: this.c[dir].fmode });
            fs.writeFileSync(d + path.sep + uid + '.k', key, { mode: this.c[dir].fmode });
            return uid;
        }
    }
};
dirdb.prototype.add = function(dir, key, val, cb) {
    if (typeof cb === 'function') { // async
        if (!(typeof dir === 'string' && dir in this.c)) { cb(new Error('dir "' + dir + '" not found')); } else {
            //if (this.c[dir].compress !== 'none') { cb(new Error('compress "' + this.c[dir].compress + '" enabled on dir "' + dir + '"')); } else {
                key = toBuffer(key);
                if (key.length === 0) { cb(new Error('empty key')); } else {
                    const p = xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
                    make(this.d + path.sep + dir, p, this.c[dir].dmode, e => {
                        if (e) { cb(e); } else {
                            const d = this.d + path.sep + dir + path.sep + p;
                            fs.readdir(d, (e, a) => {
                                if (e) { cb(e); } else {
                                    find(d, a, key, (e, uid) => { // verify if key exists
                                        if (e) {
                                            if (e.message === 'key exists' && uid) { // key found
                                                compress(toBuffer(val), this.c[dir].compress, (e, b) => {
                                                    if (e) { cb(e); } else {
                                                        fs.appendFile(d + path.sep + uid + '.v', b, { mode: this.c[dir].fmode }, e => {
                                                            if (e) { cb(e); } else { cb(undefined, uid); }
                                                        });
                                                    }
                                                });
                                            } else { cb(e); }
                                        } else { // key not found
                                            uid = this.uid();
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
                                    }, true);
                                }
                            });
                        }
                    });
                }
            //}
        }
        return this;
    } else { // sync
        if (!(typeof dir === 'string' && dir in this.c)) { throw new Error('dir "' + dir + '" not found'); }
        //if (this.c[dir].compress !== 'none') { throw new Error('compress "' + this.c[dir].compress + '" enabled on dir "' + dir + '"'); }
        key = toBuffer(key);
        if (key.length === 0) { throw new Error('empty key'); }
        const p = xpath(hash(key, this.c[dir].algorithm, this.c[dir].digest), this.c[dir].level);
        make(this.d + path.sep + dir, p, this.c[dir].dmode);
        const d = this.d + path.sep + dir + path.sep + p;
        let s, x, k = false;
        for (let v of fs.readdirSync(d)) { // verify if key exists
            x = path.parse(v);
            if (x.ext === '.k') {
                s = fs.lstatSync(d + path.sep + v);
                if (s.isFile() && s.size === key.length && key.compare(fs.readFileSync(d + path.sep + v)) === 0) { k = true; break; }
            }
        }
        if (k) { // key found
            fs.appendFileSync(d + path.sep + x.name + '.v', compress(toBuffer(val), this.c[dir].compress), { mode: this.c[dir].fmode });
            return x.name;
        } else { // key not found
            const uid = this.uid();
            fs.writeFileSync(d + path.sep + uid + '.v', compress(toBuffer(val), this.c[dir].compress), { mode: this.c[dir].fmode });
            fs.writeFileSync(d + path.sep + uid + '.k', key, { mode: this.c[dir].fmode });
            return uid;
        }
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
                                    fs.readFile(d + path.sep + uid + '.v', (e, value) => {
                                        if (e) { cb(e); } else {
                                            uncompress(value, this.c[dir].compress, (e, b) => {
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
        return this;
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
                    return { value: uncompress(fs.readFileSync(d + path.sep + x.name + '.v'), this.c[dir].compress), uid: x.name };
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
        return this;
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

function each(a, r, d, l, n, opt, k, cb) {
    if (typeof cb === 'function') { // async
        if (a.length > 0) {
            fs.lstat(d + path.sep + a[0], (e, s) => {
                if (e) { cb(e); } else {
                    if (s.isDirectory()) {
                        readdir(r, d + path.sep + a[0], l, n, opt, k, e => {
                            if (e) { cb(e); } else { each(a.splice(0, 1) ? a : a, r, d, l, n, opt, k, cb); }
                        });
                    } else {
                        if (s.isFile() && d.length === l + n) {
                            const x = path.parse(a[0]);
                            if (x.ext === '.k') {
                                if (opt && typeof opt.start === 'number') { // start point
                                    if (k.count >= opt.start) {
                                        if (opt && typeof opt.end === 'number') { // and end point (both)
                                            if (k.count < opt.end) { r[x.name] = d.substr(l).split(path.sep).join(''); }
                                        } else { r[x.name] = d.substr(l).split(path.sep).join(''); } // only start point
                                    }
                                } else if (opt && typeof opt.end === 'number') { // only end point
                                    if (k.count < opt.end) { r[x.name] = d.substr(l).split(path.sep).join(''); }
                                } else { r[x.name] = d.substr(l).split(path.sep).join(''); } // no start or end point
                                k.count++;
                            }
                        }
                        each(a.splice(0, 1) ? a : a, r, d, l, n, opt, k, cb);
                    }
                }
            });
        } else { cb(undefined, r); }
    } else { // sync
        if (a.length > 0) {
            const s = fs.lstatSync(d + path.sep + a[0]);
            if (s.isDirectory()) {
                readdir(r, d + path.sep + a[0], l, n, opt, k);
            } else {
                if (s.isFile() && d.length === l + n) {
                    const x = path.parse(a[0]);
                    if (x.ext === '.k') {
                        if (opt && typeof opt.start === 'number') { // start point
                            if (k.count >= opt.start) {
                                if (opt && typeof opt.end === 'number') { // and end point (both)
                                    if (k.count < opt.end) { r[x.name] = d.substr(l).split(path.sep).join(''); }
                                } else { r[x.name] = d.substr(l).split(path.sep).join(''); } // only start point
                            }
                        } else if (opt && typeof opt.end === 'number') { // only end point
                            if (k.count < opt.end) { r[x.name] = d.substr(l).split(path.sep).join(''); }
                        } else { r[x.name] = d.substr(l).split(path.sep).join(''); } // no start or end point
                        k.count++;
                    }
                }
            }
            each(a.splice(0, 1) ? a : a, r, d, l, n, opt, k);
        }
    }
}
function readdir(r, d, l, n, opt, k, cb) {
    if (typeof cb === 'function') { // async
        fs.readdir(d, (e, a) => {
            if (e) { cb(e); } else { each(a, r, d, l, n, opt, k, cb); }
        });
    } else { // sync
        each(fs.readdirSync(d), r, d, l, n, opt, k);
    }
}
dirdb.prototype.keys = function(dir, opt, cb) {
    if (typeof opt === 'function' && cb === undefined) { cb = opt; }
    if (typeof cb === 'function') { // async, range is disabled
        if (!(typeof dir === 'string' && dir in this.c)) { cb(new Error('dir "' + dir + '" not found')); } else {
            const l = (this.d + path.sep + dir + path.sep).length, n = divisor(this.c[dir]); // total dir length
            let r = {}, k = { count: 0 }; // init return object and number of keys
            range(opt, (e, p) => {
                if (e) { cb(e); } else { readdir(r, this.d + path.sep + dir, l, n, p, k, cb); }
            });
        }
        return this;
    } else { // sync
        if (!(typeof dir === 'string' && dir in this.c)) { throw new Error('dir "' + dir + '" not found'); }
        const l = (this.d + path.sep + dir + path.sep).length, n = divisor(this.c[dir]); // total dir length
        let r = {}, k = { count: 0 }; // init return object and number of keys
        readdir(r, this.d + path.sep + dir, l, n, range(opt), k);
        return r;
    }
};
dirdb.prototype.val = function(dir, uid, hash, cb) {
    if (typeof cb === 'function') { // async
        if (!(typeof dir === 'string' && dir in this.c)) { cb(new Error('dir "' + dir + '" not found')); } else {
            if (!(typeof uid === 'string' && uid.split('.').length === 2)) { cb(new Error('invalid uid "' + uid + '"')); } else {
                const l = hash.length;
                if (!(typeof hash === 'string' && l >= 22 && l <= 128)) { cb(new Error('invalid hash "' + hash + '"')); } else {
                    const f = this.d + path.sep + dir + path.sep + xpath(hash, this.c[dir].level) + path.sep + uid;
                    fs.readFile(f + '.k', (e, key) => {
                        if (e) { cb(e); } else {
                            fs.readFile(f + '.v', (e, v) => {
                                if (e) { cb(e); } else {
                                    uncompress(v, this.c[dir].compress, (e, value) => {
                                        if (e) { cb(e); } else { cb(undefined, key, value); }
                                    });
                                }
                            });
                        }
                    });
                }
            }
        }
        return this;
    } else { // sync
        if (!(typeof dir === 'string' && dir in this.c)) { throw new Error('dir "' + dir + '" not found'); }
        if (!(typeof uid === 'string' && uid.split('.').length === 2)) { throw new Error('invalid uid "' + uid + '"'); }
        const l = hash.length;
        if (!(typeof hash === 'string' && l >= 22 && l <= 128)) { throw new Error('invalid hash "' + hash + '"'); }
        const f = this.d + path.sep + dir + path.sep + xpath(hash, this.c[dir].level) + path.sep + uid;
        return { key: fs.readFileSync(f + '.k'), value: uncompress(fs.readFileSync(f + '.v'), this.c[dir].compress) };
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

function safeDir(dir) {
    if (typeof dir !== 'string') { return false; }
    dir = path.parse(dir).name;
    if (dir === '' || dir === '.' || dir === '..') { return false; }
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
function range(opt, cb) {
    let r;
    if (typeof opt === 'object' && ('start' in opt || 'end' in opt)) {
        const start = 'start' in opt ? parseInt(opt.start) : undefined;
        const end = 'end' in opt ? parseInt(opt.end) : undefined;
        if (start !== undefined && end !== undefined) {
            if (start < end && start >= 0 && end > 0) { r = { start: start, end: end }; }
            else {
                if (typeof cb === 'function') { cb(new Error('invalid range start "' + start + '", end "' + end + '"')); return; }
                else { throw new Error('invalid range start "' + start + '", end "' + end + '"'); }
            }
        } else if (start !== undefined) {
            if (start >= 0) { r = { start: start }; }
            else {
                if (typeof cb === 'function') { cb(new Error('invalid range start "' + start + '"')); return; }
                else { throw new Error('invalid range start "' + start + '"'); }
            }
        } else if (end !== undefined) {
            if (end > 0) { r = { end: end }; }
            else {
                if (typeof cb === 'function') { cb(new Error('invalid range end "' + end + '"')); return; }
                else { throw new Error('invalid range end "' + end + '"'); }
            }
        }
    }
    if (typeof cb === 'function') { cb(undefined, r); }
    else { return r; }
}
function compress(value, type, cb) {
    if (typeof cb === 'function') { // async
        switch (type) {
            case 'deflate': zlib.deflate(value, (e, b) => cb(e, b)); break;
            case 'gzip':    zlib.gzip(value, (e, b) => cb(e, b)); break;
            // case 'snappy':  snappy.compress(value, (e, b) => cb(e, b)); break;
            case 'none':    cb(undefined, value); break;
            default: cb(new Error('invalid compress type'));
        }
    } else { // sync
        switch (type) {
            case 'deflate': return zlib.deflateSync(value);
            case 'gzip':    return zlib.gzipSync(value);
            // case 'snappy':  return snappy.compressSync(value);
            case 'none':    return value;
            default: throw new Error('invalid compress type');
        }
    }
}
function uncompress(value, type, cb) {
    if (typeof cb === 'function') { // async
        switch (type) {
            case 'deflate': zlib.inflate(value, (e, b) => cb(e, b)); break;
            case 'gzip':    zlib.gunzip(value, (e, b) => cb(e, b)); break;
            // case 'snappy':  snappy.uncompress(value, (e, b) => cb(e, b)); break;
            case 'none':    cb(undefined, value); break;
            default: cb(new Error('invalid uncompress type'));
        }
    } else { // sync
        switch (type) {
            case 'deflate': return zlib.inflateSync(value);
            case 'gzip':    return zlib.gunzipSync(value);
            // case 'snappy':  return snappy.uncompressSync(value);
            case 'none':    return value;
            default: throw new Error('invalid uncompress type');
        }
    }
}

module.exports = dirdb;
