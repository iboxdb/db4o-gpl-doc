

export function print(...msg) {
    console.log(...msg);
}

export async function worker_echo() {
    let w = create_worker();
    return worker_call(w, worker_echo.name, arguments);
}

export async function db_echo(obj) {
    let w = create_worker();
    return worker_call(w, db_echo.name, arguments);
}

export async function db_root(path) {
    if (path != null && path != undefined) {
        db_root._path = path;
    }
    return db_root._path;
}
db_root._path = "";

export async function db_debug_deletefile(addr) {
    lock(addr);
    let w = create_worker();
    let r = await worker_call(w, db_debug_deletefile.name, [db_root._path, ...arguments]);
    w.terminate();
    unlock(addr);
    return r;
}

var globalSingleInstance = {};
function lock(addr) {
    addr = String(addr);
    if (globalSingleInstance[addr]) {
        throw new Error("Close Another Database and await.");
    }
    globalSingleInstance[addr] = addr;
}
function unlock(addr) {
    addr = String(addr);
    if (globalSingleInstance[addr] == addr) {
        globalSingleInstance[addr] = undefined;
    } else {
        throw new Error("Can not Unlock. " + addr);
    }
}

export class JsBoxAsync {

    #db = null;
    #addr = 0;
    constructor(addr = 1) {
        this.#addr = addr
        lock(this.#addr);
    }
    async #init() {
        if (this.#addr == 0) {
            throw new Error("Closed");
        }
        if (this.#db == null) {
            this.#db = create_worker();
            let o = await worker_call(this.#db, "DBWasm", [db_root._path, this.#addr]);
            // return "No modification allowed" when the Browser to limit too many files operation.
            // if using only one database, this wouldn't happen.
            // but if doing mutiple databases test, this will happen.
            // because can't open files, then will get "can't access property ..." error afterward.
            // have to RE-OPEN browser or 'new tab', call 'file.close()' or 'refresh browser' without effect.
            if (o != this.#addr) {
                throw new Error("Browser limits open new file. have to wait or reopen Browser. --" + o);
            }
        }
        return this.#db;
    }
    /**
     * @type {JsBoxConfigAsync}
     */
    async get_config() {
        return new JsBoxConfigAsync(await this.#init());
    }
    async open() {
        let w = await this.#init();
        let o = await worker_call(w, this.open.name, arguments);
        if (o != this.open.name) {
            //can't apply old data to new index.
            throw new Error(o.toString());
        }
        return this;
    }

    async close() {
        if (this.#addr != 0) {
            let w = await this.#init();
            let o = await worker_call(w, this.close.name, arguments);
            if (o != this.close.name) {
                throw new Error(o.toString());
            }
            w.terminate();
            unlock(this.#addr);
            this.#addr = 0;
        }
        return this.#addr;
    }

    // ==== methods ====

    /**
     * @returns {BigInt}
     */
    async new_id(index = 0, step = 1) {
        return worker_call(await this.#init(), this.new_id.name, arguments);
    }

    /**
     * @param {String} table 
     * @param {Object} obj 
     * @returns {Boolean}
     */
    async insert(table, obj) {
        return worker_call(await this.#init(), this.insert.name, arguments);
    }
    /**
     * @param {String} table 
     * @param {Object} obj 
     * @returns {Boolean}
     */
    async update(table, obj) {
        return worker_call(await this.#init(), this.update.name, arguments);
    }
    /**
     * @param {String} table 
     * @param {Object} obj 
     * @returns {Boolean}
     */
    async replace(table, obj) {
        return worker_call(await this.#init(), this.replace.name, arguments);
    }

    /**
     * @param {String} table 
     * @param  {...any} key 
     * @returns @type {Boolean}
     */
    async delete(table, ...key) {
        return worker_call(await this.#init(), this.delete.name, arguments);
    }

    /**
     * 
     * @param {String} table 
     * @param  {...any} key 
     * @returns {Object}
     */
    async get(table, ...key) {
        return worker_call(await this.#init(), this.get.name, arguments);
    }

    /**
     * 
     * @param {String} ql 
     * @param  {...any} params 
     * @returns {Object[]}
     */
    async select(ql, ...params) {
        return worker_call(await this.#init(), this.select.name, arguments);
    }

    /**
     * 
     * @param {String} ql 
     * @param  {...any} params 
     * @returns {BigInt}
     */
    async count(ql, ...params) {
        return worker_call(await this.#init(), this.count.name, arguments);
    }

}


export class JsBoxConfigAsync {

    #cfg = null;
    constructor(cfg) {
        this.#cfg = cfg;
    }
    /**
     * @param {Object} protoType 
     * @param {String} tableName 
     * @param  {...String} key 
     */
    async ensure_table(protoType, tableName, ...key) {
        let o = await worker_call(this.#cfg, this.ensure_table.name, arguments);
        if (o != this.ensure_table.name) {
            throw new Error(o.toString());
        }
        return this;
    }
    /**
     * @param {Object} protoType 
     * @param {String} tableName 
     * @param {Boolean} isUnique 
     * @param  {...String} names  
     */
    async ensure_index(protoType, tableName, isUnique, ...names) {
        let o = await worker_call(this.#cfg, this.ensure_index.name, arguments);
        if (o != this.ensure_index.name) {
            throw new Error(o.toString());
        }
        return this;
    }
    /**
     * @param {Object} protoType 
     * @param {String} tableName 
     * @param  {...String} names 
     */
    async ensure_increment(protoType, tableName, ...names) {
        let o = await worker_call(this.#cfg, this.ensure_increment.name, arguments);
        if (o != this.ensure_increment.name) {
            throw new Error(o.toString());
        }
        return this;
    }

}

function create_worker(u = "./load_iboxdb_worker.js") {
    let w = new Worker(new URL(u, import.meta.url), { type: "module" });
    return w;
}

function worker_call(w, methodName, args) {
    if (w.running == true) {
        let m = "single worker_call only, use await.";
        throw new Error(m);
    }
    w.running = true
    return new Promise((r) => {
        w.onmessage = (m) => {
            w.running = false;
            r(m.data);
        }
        try {
            w.postMessage([methodName, [...args]])
        } catch (e) {
            w.running = false;
            throw e;
        }
    })
}

export async function _debug_fun() {
    let dir = await navigator.storage.getDirectory();
    for await (let x of dir.keys()) {
        print(x);
    }
    let o = await worker_echo("aaa", { id: "bbb" }, 1, 2n, new Date(), new Int8Array([-1, -2]));
    print(o);
    o = await db_echo({ "id": 99n, value: 88 });
    print(o);
    o = await db_root("./root");
    print(o);
    o = await db_debug_deletefile(88);
    print(o);

    let def_proto = {
        "id": BigInt(1),
        "name": String('_'),
        "val": Number(8.8),
        "version": BigInt(1),
        "dt": new Date(),
        "isGood": Boolean(true),
        "file": new Uint8Array([3, 255, 254, 253, 4]),
        "ar": [3, 4, { "id": 18, "nogood": false }, { "id": 19n, "vv": "OK" }],
    }

    await db_debug_deletefile(21);
    let js = new JsBoxAsync(21);
    let cfg = await js.get_config();
    print(await cfg.ensure_table(def_proto, "table", "id"));
    print(await cfg.ensure_index(def_proto, "table", false, "name", "val"));
    print(await cfg.ensure_increment(def_proto, "table", "version"));
    print(await js.open());

    def_proto.id = await js.new_id();
    def_proto.name = def_proto.id + ".name";
    print(await js.insert("table", def_proto));

    def_proto.id = await js.new_id();
    def_proto.name = def_proto.id + ".name";
    print(await js.replace("table", def_proto));

    print(await js.select("from table where id==? | id==?", 1, 2n));
    print(await js.count("from table where id>?", 0), await js.count("table"));
    print(await js.close());

    js = new JsBoxAsync(21);
    cfg = await js.get_config();
    print(await cfg.ensure_table(def_proto, "table", "name"));
    print(await js.open());
    def_proto.id = await js.new_id();
    def_proto.name = def_proto.id + ".name";
    print(await js.insert("table", def_proto));
    print(await js.close());
    print("end load_iboxdb_opfs.js");
}

//await _debug_fun();
