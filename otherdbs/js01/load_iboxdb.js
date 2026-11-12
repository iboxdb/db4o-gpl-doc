
// ===== JavaScript IO System =====

class WasmDatabaseConfig {
	static bufs = {}
	static get(path) {
		this.bufs[path] = this.bufs[path] ?? new WasmBStream(path);
		return this.bufs[path]
	}

	CacheLength() {
		return 1024n * 1024n * 64n;
	}
	FileIncSize() {
		// Bigger IncSize less calling Resize()
		return 1024n * 1024n * 1n;
	}
	SwapFileBuffer() {
		// In Memory, Disable the SwapFile.
		return 0n;
	}

	CreateStream(path, access) {
		return WasmDatabaseConfig.get(path);
	}
	ExistsStream(path) {
		return WasmDatabaseConfig.bufs.hasOwnProperty(path);
	}

	DeleteStream(path) {
		WasmDatabaseConfig.bufs[path]?.SetLength(0);
		return true;
	}
}

class WasmBStream {
	constructor(_path) {
		this.path = _path;
		this.int8View = new Int8Array(0);
	}

	Read(position, buffer, offset, count) {
		let mlen = BigInt(this.int8View.length) - position;
		count = count > mlen ? mlen : count;
		buffer.set(this.int8View.subarray(Number(position), Number(position + count)), Number(offset));
		return count;
	}

	Write(position, buffer, offset, count) {
		let fmax = position + count + 8n;
		if (this.int8View.length < fmax) {
			this.SetLength(fmax);
		}
		this.int8View.set(buffer.subarray(Number(offset), Number(offset + count)), Number(position));
	}

	Length() {
		return BigInt(this.int8View.length);
	}

	SetLength(value) {
		// value would be Zero!
		let o = this.int8View;
		this.int8View = new Int8Array(Number(value));
		if (value > 0) {
			this.int8View.set(o, 0);
		}
	}

}


// ===== JavaScript VM =====
import { InitWasmDatabaseConfigObject } from "./teavm/classes.js";
const { DBHelper, DBWasm } = InitWasmDatabaseConfigObject(new WasmDatabaseConfig());

// ===== export functions =====
export function db_echo(obj) {
	return DBHelper().echo(obj);
}

export function db_debug_deletefile(addr) {
	return DBHelper().db_debug_deletefile(addr);
}

export class JsBox {

	/**
	 * @type {DBWasm}
	 */
	#db = null;

	/**
	 * @type {AutoBoxGen}
	 */
	#auto = null;

	#addr = 0;
	constructor(addr = 1) {
		this.#addr = addr
		this.#db = DBWasm(addr);
	}
	/**
	 * @returns @type {JsBoxConfig}
	 */
	get_config() {
		const cfg = this.#db.get_config();
		return new JsBoxConfig(cfg);

	}

	/**
	 * @returns @type {JsBox}
	 */
	open() {
		this.#auto = this.#db.open_doc();
		return this;
	}

	close() {
		if (this.#auto != null) {
			this.#auto.close_db();
			this.#auto = null;
			this.#db = null;
		}
	}

	// ==== methods ====

	/**
	 * @returns {BigInt}
	 */
	new_id(index = 0, step = 1) {
		return this.#auto.new_id(index, step);
	}

	/**
	 * @param {String} table 
	 * @param {Object} obj 
	 * @returns {Boolean}
	 */
	insert(table, obj) {
		return this.#auto.insert(table, obj);
	}
	/**
	 * @param {String} table 
	 * @param {Object} obj 
	 * @returns {Boolean}
	 */
	update(table, obj) {
		return this.#auto.update(table, obj);
	}
	/**
	 * @param {String} table 
	 * @param {Object} obj 
	 * @returns {Boolean}
	 */
	replace(table, obj) {
		return this.#auto.replace(table, obj);
	}

	/**
	 * @param {String} table 
	 * @param  {...any} key 
	 * @returns @type {Boolean}
	 */
	delete(table, ...key) {
		return this.#auto.delete(table, key);
	}

	/**
	 * 
	 * @param {String} table 
	 * @param  {...any} key 
	 * @returns {Object}
	 */
	get(table, ...key) {
		return this.#auto.get(table, key);
	}

	/**
	 * 
	 * @param {String} ql 
	 * @param  {...any} params 
	 * @returns {Object[]}
	 */
	select(ql, ...params) {
		return this.#auto.select(ql, params);
	}

	/**
	 * 
	 * @param {String} ql 
	 * @param  {...any} params 
	 * @returns {BigInt}
	 */
	count(ql, ...params) {
		return this.#auto.count(ql, params);
	}
}


export class JsBoxConfig {

	/**
	 * @type {DatabaseConfigGen}
	 */
	#cfg = null;
	constructor(cfg) {
		this.#cfg = cfg;
	}
	/**
	 * @param {Object} protoType 
	 * @param {String} tableName 
	 * @param  {...String} key 
	 */
	ensure_table(protoType, tableName, ...key) {
		this.#cfg.ensure_table(protoType, tableName, key);
		return this;
	}
	/**
	 * @param {Object} protoType 
	 * @param {String} tableName 
	 * @param {Boolean} isUnique 
	 * @param  {...String} names  
	 */
	ensure_index(protoType, tableName, isUnique, ...names) {
		this.#cfg.ensure_index(protoType, tableName, isUnique, names);
		return this;
	}
	/**
	 * @param {Object} protoType 
	 * @param {String} tableName 
	 * @param  {...String} names 
	 */
	ensure_increment(protoType, tableName, ...names) {
		this.#cfg.ensure_increment(protoType, tableName, names);
		return this;
	}

}

//========== DEBUG ==========================//
export function print(...msg) {
	console.log(...msg);
}

export async function pause(msg) {
	try {
		const readline = await import("readline");
		const t = readline.createInterface(process.stdin, process.stdout);
		t.question(msg, (b) => {
			t.close();
		});
	} catch (e) {
		print(msg);
		return e;
	}
}

export function is_node() {
	if (typeof process === "object" && "argv" in process) {
		return true;
	} else {
		return false;
	}
}


function is_main() {
	try {
		return import.meta.url === import.meta.resolve(process.argv[1]);
	} catch {
		return false;
	}
}

