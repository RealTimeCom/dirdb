/* SOURCE FILE - Copyright (c) 2018 dirdb - Tanase Laurentiu Iulian - https://github.com/RealTimeCom/dirdb */

const fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    zlib = require('zlib'),
    //snappy = require('snappy'),
    pr = require('util').promisify,
    //rpc = require('../rpc-json/index.js'),
    rpc = require('rpc-json'),
    rmdir = require('rm-dir');

class dirdb {
    constructor(dir, opt) {
        this._opt = typeof opt === 'object' ? options(opt, dirdb._def) : dirdb._def; // overwrite default dir options
        this._cnf = '.dirdb.json'; // dir config file name
        this._cnt = 0; // counter for _uid
        try {
            if (typeof dir !== 'string') { throw new Error('invalid dir type "' + (typeof dir) + '", String expected'); }
            dir = path.normalize(dir);
            if (dir === '' || dir === '.' || dir === '..') { throw new Error('invalid dir path name "' + dir + '"'); }
            if (!fs.lstatSync(dir).isDirectory()) { throw new Error('dir "' + dir + '" is not directory'); }
            this._mem = scan(dir, this._cnf, this._opt); // sync scan and cache config directories
            this._dir = dir; // cache db directory path
        } catch (e) {
            throw e;
        }
    }
    static get _def() { // default dir options
        return { level: 3, dmode: 0o700, fmode: 0o600, algorithm: 'md5', digest: 'base64', compress: 'none', gc: true };
    }
    get _uid() {
        if (this._cnt === 1e9) { this._cnt = 0; } // reset on max '1e9' value
        return new Date().getTime().toString(36) + '.' + (this._cnt++).toString(36); // extract: parseInt(uid.split('.')[0], 36) - birthtime
    }

    static server(db) { return new server(db); }
    static client() { return new client; }

    mkdir(dir, opt) {
        if (!(dir = safe(dir))) { return Promise.reject(new Error('mkdir() invalid dir value')); }
        if (dir in this._mem) { return Promise.reject(new Error('mkdir() dir "' + dir + '" exists in cache')); }
        opt = options(opt, this._opt); // parse options
        return pr(fs.mkdir)(this._dir + path.sep + dir, opt.dmode). // make dir
        then(pr(fs.writeFile)(this._dir + path.sep + dir + path.sep + this._cnf, JSON.stringify(opt), { mode: opt.fmode })). // write 'this._cnf' file config
        then(() => {
            this._mem[dir] = opt; // add dir conf on cache 'this._mem'
            return { [dir]: opt };
        });
    }
    setgc(dir, opt) {
        if (!(typeof dir === 'string' && dir in this._mem)) { return Promise.reject(new Error('setgc() dir "' + dir + '" not found in cache')); }
        opt = Boolean(opt);
        const mem = this._mem[dir];
        if (mem.gc !== opt) {
            mem.gc = opt;
            return pr(fs.writeFile)(this._dir + path.sep + dir + path.sep + this._cnf, JSON.stringify(mem), { mode: mem.fmode }). // rewrite gc value on 'this._cnf' file config
            then(() => {
                this._mem[dir].gc = opt; // rewrite gc value on cache 'this._mem'
                return opt;
            });
        } else {
            return Promise.resolve(opt);
        }
    }
    rmdir(dir) {
        if (!(typeof dir === 'string' && dir in this._mem)) { return Promise.reject(new Error('rmdir() dir "' + dir + '" not found in cache')); }
        return rmdir.promise(this._dir + path.sep + dir).then(() => {
            if (dir in this._mem) { delete this._mem[dir]; } // remove dir conf from cache 'this._mem'
            return dir;
        });
    }
    isdir(dir) {
        return Promise.resolve(typeof dir === 'string' && dir in this._mem);
    }
    list() {
        return Promise.resolve(this._mem);
    }
}

class server extends rpc.server {
    constructor(db) {
        super(request);
        if (db instanceof dirdb) {
            this.db = db;
        } else {
            throw new Error('invalid dirdb object');
        }
    }
}

class client extends rpc.client {
    constructor() { super(); }
    mkdir(dir, opt) {
        return this.exec({ f: 'mkdir', d: dir, o: opt }).then(bk1);
    }
    setgc(dir, opt) {
        return this.exec({ f: 'setgc', d: dir, o: Boolean(opt) }).then(bk1);
    }
    rmdir(dir) {
        return this.exec({ f: 'rmdir', d: dir }).then(bk1);
    }
    isdir(dir) {
        return this.exec({ f: 'isdir', d: dir }).then(bk1);
    }
    list() {
        return this.exec({ f: 'list' }).then(bk1);
    }
}

function bk1(r) {
    if (r.head.e) { throw new Error(r.head.e); } else { return r.head.r; }
}

function options(opt, def) {
    if (typeof opt === 'object') {
        const algorithm = 'algorithm' in opt && typeof opt.algorithm === 'string' && (opt.algorithm === 'md5' || opt.algorithm === 'sha1' || opt.algorithm === 'sha256' || opt.algorithm === 'sha512') ? opt.algorithm : def.algorithm;
        const digest = 'digest' in opt && typeof opt.digest === 'string' && (opt.digest === 'base64' || opt.digest === 'hex') ? opt.digest : def.digest;
        let level = def.level;
        if ('level' in opt) {
            const l = parseInt(opt.level);
            if (l >= 0 && l < 128) {
                if (algorithm === 'md5') {
                    if (digest === 'base64' && l < 22) { level = l; } else if (digest === 'hex' && l < 32) { level = l; }
                } else if (algorithm === 'sha1') {
                    if (digest === 'base64' && l < 27) { level = l; } else if (digest === 'hex' && l < 40) { level = l; }
                } else if (algorithm === 'sha256') {
                    if (digest === 'base64' && l < 43) { level = l; } else if (digest === 'hex' && l < 64) { level = l; }
                } else if (algorithm === 'sha512') {
                    if (digest === 'base64' && l < 86) { level = l; } else if (digest === 'hex' && l < 128) { level = l; }
                }
            }
        }
        return {
            level: level,
            dmode: 'dmode' in opt ? parseInt(opt.dmode) : def.dmode,
            fmode: 'fmode' in opt ? parseInt(opt.fmode) : def.fmode,
            algorithm: algorithm,
            digest: digest,
            compress: 'compress' in opt && typeof opt.compress === 'string' && (opt.compress === 'none' || opt.compress === 'deflate' || opt.compress === 'gzip') ? opt.compress : def.compress, // || opt.compress === 'snappy'
            gc: 'gc' in opt ? Boolean(opt.gc) : def.gc
        };
    } else {
        return def;
    }
}

function scan(dir, cnf, opt) {
    let s, c = {};
    for (let v of fs.readdirSync(dir)) { // scan each dir
        s = fs.lstatSync(dir + path.sep + v);
        if (s.isDirectory()) {
            s = fs.lstatSync(dir + path.sep + v + path.sep + cnf); // read dir config file
            if (s.isFile() && s.size > 0) {
                c[v] = options(JSON.parse(fs.readFileSync(dir + path.sep + v + path.sep + cnf).toString()), opt); // parse options
            }
        }
    }
    return c;
}

function safe(dir) {
    if (typeof dir !== 'string') { return false; }
    dir = path.parse(dir).name;
    if (dir === '' || dir === '.' || dir === '..') { return false; }
    return dir;
}

async function request(resp, head, body) {
    try {
        if (!('f' in head && typeof head.f === 'string')) { throw new Error('header function is undefined'); }
        switch (head.f) {
            case 'mkdir':
            case 'setgc':
                return await resp({ r: await this.db[head.f](head.d, head.o) });
            case 'rmdir':
            case 'isdir':
                return await resp({ r: await this.db[head.f](head.d) });
            case 'list':
                return await resp({ r: await this.db[head.f]() });
            default:
                throw new Error('function "' + head.f + '" not found');
        }
    } catch (e) {
        await resp({ e: e.message });
        return Promise.reject(e);
    }
}

module.exports = dirdb;