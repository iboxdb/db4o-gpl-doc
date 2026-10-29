

import {
    JsBox, JsBoxConfig,
    ConfigVariable, db_root, db_debug_deletefile,
    InMemoryStore, print, pause, is_node
} from "./load_iboxdb.js";


const nf = (n) => {
    n = parseInt(n);
    return new Intl.NumberFormat().format(n);
}

export function test_db_online(script) {
    try {
        //InMemoryStore.bufs
        let o = eval(script);
        return o;
    } catch (e) {
        return e;
    }
}
export function test2() {
    print("===============================")
    print("iBoxDB.Java & TeaVM JavaScript!")
    print("===============================")

    // Prototype
    const proto = { "id": BigInt(0), "value": String("_"), "ver": BigInt(0) }

    print("")
    print("Single User Testing : ")

    const db_address = 19

    db_root("../DBRoot");
    db_debug_deletefile(db_address);

    let js = new JsBox(db_address)
    /**
     * @type {JsBoxConfig}
     */
    let cfg = js.get_config();
    cfg.ensure_table(proto, "table", "id");
    cfg.ensure_index(proto, "table", false, "value");
    cfg.ensure_increment(proto, "table", "ver");

    js.open();
    let re_select = 2
    let total = 500

    if (is_node()) {
        //nodejs
        total = 5000;
    } else {
        total = 2000;
    }
    //total = 10

    let begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        let v = { ...proto }
        // BigInt
        v.id = js.new_id();
        v.value = String(i)
        if (!js.insert("table", v))
            print("Check Insert")
    }
    let watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Insert AVG: ${nf(total / watch)}`)


    begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        let v = js.get("table", BigInt(i))
        v.value = "UP:" + String(i)
        if (!js.update("table", v))
            print("Check Update")
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Update AVG: ${nf(total / watch)}`)


    let fc = js.count("from table")
    print(`Count     : ${nf(fc)}`)

    begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        if (!js.delete("table", BigInt(i)))
            print("Check Delete")
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Delete AVG: ${nf(total / watch)}`)

    fc = js.count("from table")
    print(`Count     : ${nf(fc)}`)


    begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        let v = { ...proto }
        v.id = typeof (proto.id) == "bigint" ? BigInt(i) : i;
        v.value = String(i);
        if (!js.replace("table", v))
            print("Check Replace 1")
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Replace-1 AVG: ${nf(total / watch)}`)
    fc = js.count("from table where id>=? & id<=?", -1000000000n, 1000000000n)
    print(`Count     : ${nf(fc)}`)


    begin = Date.now()
    for (let i = 1; i < total + 1; i++) {
        let v = { ...proto }
        v.id = typeof (proto.id) == "bigint" ? BigInt(i) : i;
        v.value = "up" + String(i);
        if (!js.replace("table", v))
            print("Check Replace 2")
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Replace-2 AVG: ${nf(total / watch)}`)
    fc = js.count("from table where id>? & id<?", -100000001n, 100000001n)
    print(`Count     : ${nf(fc)}`)

    for (let i = 1; i < total + 1; i++) {
        let v = null;
        switch (i % 3) {
            case 0:
                // id should use BigInt().
                v = js.get("table", BigInt(i));
                break;
            case 1:
                // Number works but not recommended.
                v = js.get("table", Number(i));
                break;
            case 2:
                v = js.select("from table where id==?", BigInt(i))[0]
                break;
        }
        if (!String(v["value"]).startsWith("up"))
            print("Check Replace 3")
    }
    if (js.get("table", -99999999n) != null) {
        print("Check Replace 4")
    }

    let get_count = 0
    begin = Date.now()
    for (let t = 0; t < re_select; t++)
        for (let i = 1n; i < BigInt(total) + 1n; i++) {
            let v = js.get("table", i)
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
    js.close();
    js = null

    js = new JsBox(db_address)
    js.open();


    let sel_count = 0
    begin = Date.now()
    for (let t = 0; t < re_select; t++) {
        print(`Time:${t + 1} / ${re_select}`)
        for (let i = 1n; i < BigInt(total) + 1n; i++) {
            let st = js.select("from table where id>=? & id<=?", i, i + 64n)
            for (let x = 0; x < st.length; x++) {
                const s = st[x];
                if (typeof (s.id) == "bigint" && s.id > 0n)
                    sel_count = sel_count + 1;
                else
                    print("Check Select");
            }
        }
    }
    watch = (Date.now() - begin) / 1000
    watch = Math.max(watch, 1)
    print(`Select AVG: ${nf(sel_count / watch)}/s`)

    js.close();

    pause("End.");
}



function is_main() {
    try {
        return import.meta.url === import.meta.resolve(process.argv[1]);
    } catch {
        return false;
    }
}
if (is_main()) {
    test2();
}
