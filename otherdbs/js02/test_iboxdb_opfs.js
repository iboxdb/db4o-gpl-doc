


import {
    JsBoxAsync, JsBoxConfigAsync,
    db_root, db_debug_deletefile,
    print
} from "./load_iboxdb_opfs.js";

const nf = (n) => {
    n = parseInt(n);
    return new Intl.NumberFormat().format(n);
}

export function help() {
    let o = [];
    o.push(JsBoxAsync.prototype.insert.toString());
    o.push(JsBoxAsync.prototype.update.toString());
    o.push(JsBoxAsync.prototype.replace.toString());
    o.push(JsBoxAsync.prototype.delete.toString());
    o.push(JsBoxAsync.prototype.get.toString());
    o.push(JsBoxAsync.prototype.select.toString());
    o.push(JsBoxAsync.prototype.count.toString());
    return o.join("\r\n");
}

export async function test_db_online(script) {
    if (test_db_online.running == true) {
        return "test_db_online, single thread only";
    }
    try {
        test_db_online.running = true;
        let c = "(async ()=> { " + script + " })();";
        let o = eval(c);
        o = await o;
        return o;
    } catch (e) {
        test_db_online.running = false;
        return e;
    } finally {
        test_db_online.running = false;
    }
}

export async function test3() {

    print("=============================")
    print("iBoxDB.Java & TeaVM JS OPFS!")
    print("=============================")

    // Prototype
    const proto = { "id": BigInt(0), "value": String("_"), "ver": BigInt(0) }

    print("")
    const db_address = 21

    await db_root("./");
    await db_debug_deletefile(db_address);

    let js = new JsBoxAsync(db_address)

    let cfg = await js.get_config();
    await cfg.ensure_table(proto, "table", "id");
    await cfg.ensure_index(proto, "table", false, "value");
    await cfg.ensure_increment(proto, "table", "ver");

    await js.open();
    let re_select = 2
    let total = 500

    //total = 10

    let begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        let v = { ...proto }
        // BigInt
        v.id = await js.new_id();
        v.value = String(i)
        let io = await js.insert("table", v);
        if (io != true)
            print("Check Insert ", io)
    }
    let watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Insert AVG: ${nf(total / watch)}`)


    begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        let v = await js.get("table", BigInt(i))
        v.value = "UP:" + String(i)
        if (! await js.update("table", v))
            print("Check Update")
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Update AVG: ${nf(total / watch)}`)


    let fc = await js.count("from table")
    print(`Count     : ${nf(fc)}`)

    begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        if (! await js.delete("table", BigInt(i)))
            print("Check Delete")
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Delete AVG: ${nf(total / watch)}`)

    fc = await js.count("from table")
    print(`Count     : ${nf(fc)}`)


    begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        let v = { ...proto }
        v.id = typeof (proto.id) == "bigint" ? BigInt(i) : i;
        v.value = String(i);
        if (! await js.replace("table", v))
            print("Check Replace 1")
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Replace-1 AVG: ${nf(total / watch)}`)
    fc = await js.count("from table where id>=? & id<=?", -1000000000n, 1000000000n)
    print(`Count     : ${nf(fc)}`)


    begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        let v = { ...proto }
        v.id = typeof (proto.id) == "bigint" ? BigInt(i) : i;
        v.value = "up" + String(i);
        if (!await js.replace("table", v))
            print("Check Replace 2")
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Replace-2 AVG: ${nf(total / watch)}`)
    fc = await js.count("from table where id>? & id<?", -100000001n, 100000001n)
    print(`Count     : ${nf(fc)}`)


    for (let i = 1; i < total + 1; i++) {
        let v = null;
        switch (i % 3) {
            case 0:
                // id should use BigInt().
                v = await js.get("table", BigInt(i));
                break;
            case 1:
                // Number works but not recommended.
                v = await js.get("table", Number(i));
                break;
            case 2:
                v = (await js.select("from table where id==?", BigInt(i)))[0]
                break;
        }
        if (!String(v["value"]).startsWith("up"))
            print("Check Replace 3")
    }
    if (await js.get("table", -99999999n) != null) {
        print("Check Replace 4")
    }


    let get_count = 0
    begin = Date.now()
    for (let t = 0; t < (re_select * 2); t++)
        for (let i = 1n; i < BigInt(total) + 1n; i++) {
            let v = await js.get("table", i)
            if (v["id"] !== i)
                print("Check Get")
            else
                get_count = get_count + 1
        }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Get()  AVG: ${nf(get_count / watch)}/s`)
    get_count = 0

    //Re-Open
    await js.close();
    js = null

    js = new JsBoxAsync(db_address)
    await js.open();

    let sel_count = 0
    begin = Date.now()
    for (let t = 0; t < re_select; t++) {
        print(`Time:${t + 1} / ${re_select}`)
        for (let i = 1n; i < BigInt(total) + 1n; i++) {
            let st = await js.select("from table where id>=? & id<=?", i, i + 64n)
            for (let x = 0; x < st.length; x++) {
                const s = st[x];
                if (typeof (s.id) == "bigint" && s.id > 0n)
                    sel_count = sel_count + 1;
                else
                    print("Check Select");

                if (!String(s["value"]).startsWith("up"))
                    print("Check Select")
            }
        }
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Select AVG: ${nf(sel_count / watch)}/s`)

    await js.close();


    print("End.")

}