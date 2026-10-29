
// ===== JavaScript IO System =====

var ConfigVariable = {

    CacheLength: 1024n * 1024n * 64n,
    FileIncSize: 1024n * 1024n * 1n,
    SwapFileBuffer: 1024n * 512n,
}

//ConfigVariable.CacheLength = ConfigVariable.FileIncSize = ConfigVariable.SwapFileBuffer = 1;


class OpfsDatabaseConfig {

    CacheLength() {
        //console.log("Log:CacheLength");
        return BigInt(ConfigVariable.CacheLength);
    }
    FileIncSize() {
        //console.log("Log:FileIncSize");
        return BigInt(ConfigVariable.FileIncSize);
    }
    SwapFileBuffer() {
        //console.log("Log:SwapFileBuffer");
        return BigInt(ConfigVariable.SwapFileBuffer);
    }

    CreateStream(path, access) {
        //console.log("Log:CreateStream", path, access);
        return new OpfsBStream(this, path, access);
    }
    ExistsStream(path) {
        let r = FileStore.bufs.hasOwnProperty(path);
        //console.log("Log:ExistsStream", path, r);
        return r;
    }

    DeleteStream(path) {
        //console.log("Log:DeleteStream ", path);
        FileStore.bufs[path].truncate(0);
        //no effect.
        //FileStore.bufs[path].close();
        return true;
    }
    Root(path) {
        //console.log("Log:Root ", path);
        return path;
    }
}


class FileStore {
    static bufs = {}
    static get(path) {
        return this.bufs[path];
    }
}

class OpfsBStream {
    constructor(_cfg, _path, _access) {
        //console.log("Log:OpfsBStream constructor", _path);
        this.cfg = _cfg;
        this.path = _path;
        this.access = _access;

        this.int8View = FileStore.get(this.path);
    }

    Read(position, buffer, offset, count) {
        //console.log("Log:OpfsBStream Read", this.path, buffer.constructor.name, position, offset, count, this.int8View.length);
        buffer = buffer.subarray(Number(offset), Number(offset + count));
        return BigInt(this.int8View.read(buffer, { at: Number(position) }));
    }

    Write(position, buffer, offset, count) {
        //console.log("Log:OpfsBStream Write", this.path, buffer.constructor.name, position, offset, count, this.int8View.length);
        buffer = buffer.subarray(Number(offset), Number(offset + count));
        this.int8View.write(buffer, { at: Number(position) });
    }

    Length() {
        //console.log("Log:OpfsBStream Length", this.path);
        return BigInt(this.int8View.getSize());
    }

    SetLength(value) {
        //console.log("Log:OpfsBStream SetLength", this.path, value);
        // value would be Zero!
        this.int8View.truncate(Number(value));
    }

    Flush() {
        //console.log("Log:OpfsBStream Flush", this.path);
        // Directly write to FileIO
        // no cache or buffer to flush.
        // let the under OS to do the rest.
    }

    Dispose() {
        //console.log("Log:OpfsBStream Dispose", this.path);
        // Dispose() might be called many times.
        // let the under OS to do the rest.
        // FileStore is shared with Read and Write Streams.
    }
}

// ===== Opfs VM =====
import { InitWasmDatabaseConfigObject } from "./teavm/classes.js";
const { DBHelper, DBWasm } = InitWasmDatabaseConfigObject(new OpfsDatabaseConfig());

function print(...msg) {
    console.log(...msg);
}

function worker_echo() {
    return [worker_echo.name, ...arguments];
}

function db_echo(obj) {
    return DBHelper().echo(obj);
}

function db_root(path) {
    return DBHelper().db_root(path);
}
async function db_debug_deletefile(root, addr) {
    await create_db_files(root, addr);
    DBHelper().db_debug_deletefile(addr);
    return db_debug_deletefile.name;
}

function close_file_store() {
    for (let path in FileStore.bufs) {
        //no effect.
        //FileStore.bufs[path].close();
    }
}

let thread_DBWasm = null;
let thread_config = null;
let thread_auto = null;
async function create_db_files(root, addr) {
    if (BigInt(addr) == 0 || thread_DBWasm != null) {
        return addr;
    }
    db_root(root);
    // Browser Root only.
    let root_dir = await navigator.storage.getDirectory();
    let dfs = DBHelper().get_db_files(addr);
    for (let d of dfs) {
        let fh = await root_dir.getFileHandle(d, { create: true });
        FileStore.bufs[d] = await fh.createSyncAccessHandle();
        //print(d, FileStore.bufs[d].getSize());
    }
    thread_DBWasm = DBWasm(addr);
    thread_config = thread_DBWasm.get_config();
    return addr;
}

class CM {
    open() {
        if (thread_auto == null)
            thread_auto = thread_DBWasm.open_doc();
        return this.open.name;
    }

    close() {
        if (thread_auto != null) {
            thread_auto.close_db();
            thread_auto = thread_DBWasm = thread_config = null;
            close_file_store();
        }
        return this.close.name;
    }
    new_id(index, step) {
        return thread_auto.new_id(index, step);
    }

    insert(table, obj) {
        return thread_auto.insert(table, obj);
    }
    update(table, obj) {
        return thread_auto.update(table, obj);
    }
    replace(table, obj) {
        return thread_auto.replace(table, obj);
    }

    delete(table, ...key) {
        return thread_auto.delete(table, key);
    }

    get(table, ...key) {
        return thread_auto.get(table, key);
    }

    select(ql, ...params) {
        return thread_auto.select(ql, params);
    }

    count(ql, ...params) {
        return thread_auto.count(ql, params);
    }
}
const cm = new CM();


function ensure_table(protoType, tableName, ...key) {
    if (thread_auto == null)
        thread_config.ensure_table(protoType, tableName, key);
    return ensure_table.name;
}

function ensure_index(protoType, tableName, isUnique, ...names) {
    if (thread_auto == null)
        thread_config.ensure_index(protoType, tableName, isUnique, names);
    return ensure_index.name;
}

function ensure_increment(protoType, tableName, ...names) {
    if (thread_auto == null)
        thread_config.ensure_increment(protoType, tableName, names);
    return ensure_increment.name;
}



onmessage = async (ev) => {
    let result = "NoMethod ?";
    try {
        const methodName = ev.data[0];
        const methodArgs = ev.data[1];
        if (!(methodArgs instanceof Array)) {
            methodArgs = [methodArgs];
        }
        result = "NoMethod " + methodName;
        switch (methodName) {
            case cm.new_id.name:
                result = cm.new_id.apply(cm, methodArgs);
                break;
            case cm.insert.name:
                result = cm.insert.apply(cm, methodArgs);
                break;
            case cm.update.name:
                result = cm.update.apply(cm, methodArgs);
                break;
            case cm.replace.name:
                result = cm.replace.apply(cm, methodArgs);
                break;
            case cm.delete.name:
                result = cm.delete.apply(cm, methodArgs);
                break;
            case cm.get.name:
                result = cm.get.apply(cm, methodArgs);
                break;
            case cm.select.name:
                result = cm.select.apply(cm, methodArgs);
                break;
            case cm.count.name:
                result = cm.count.apply(cm, methodArgs);
                break;

            case cm.open.name:
                result = cm.open.apply(cm, methodArgs);
                break;
            case cm.close.name:
                result = cm.close.apply(cm, methodArgs);
                break;

            case worker_echo.name:
                result = worker_echo.apply(null, methodArgs);
                break;
            case db_echo.name:
                result = db_echo.apply(null, methodArgs);
                break;

            case ensure_table.name:
                result = ensure_table.apply(null, methodArgs);
                break;
            case ensure_index.name:
                result = ensure_index.apply(null, methodArgs);
                break;
            case ensure_increment.name:
                result = ensure_increment.apply(null, methodArgs);
                break;

            case db_debug_deletefile.name:
                result = await db_debug_deletefile.apply(null, methodArgs);
                break;
            case "DBWasm":
                result = await create_db_files.apply(null, methodArgs);
                break;
        }
    } catch (e) {
        result = "on_message: " + e.message;
    }
    postMessage(result);
}



