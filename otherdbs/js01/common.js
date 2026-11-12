

function json_string(o) {
    let os = o
    if (!(os instanceof Array)) {
        os = [os];
    }
    for (let x of os) {
        for (let y in x) {
            if (x[y] instanceof Date) {
                // JSON uses UTC time, local time easy to read.
                x[y] = x[y].toLocaleString();
            }
        }
    }
    return JSON.stringify(o, (k, v) => {
        if (typeof (v) == "bigint"){
            // when using Number 98765432109876543 will become 98765432109876540
            // BigInt is bigger, support to MAX 987654321098765432n, 2 digits more.
            // Maxmium in Java is BigInt(0x7fffffffffffffff) = 9223372036854775808n
            // DB supports BigInteger, but in this JavaScript version using Int64 only.
            // for more bigger data, to use Int8Array() or String().
            return v.toString() + "n";
        }else if (v instanceof Error)
            return v.toString();
        else if (v instanceof Int8Array) {
            // support Int8Array only, will convert Uint8Array to Int8Array inside.
            let t = v.subarray(0, Math.min(6, v.length));
            return t.toString() + "...L" + v.length;
        }
        else
            return v;
    }, 2);
}


function debug_types() {
    let types = [undefined, null, true, 2, 3.3, 4n, "5_5", new Date(),
        { "id": 88n, "dd": new Int8Array([88, 99]) },
        new Int8Array([5, 6, 255, 254, 253])]

    let def_proto = {
        "id": BigInt(1),
        "name": String('_'),
        "val": Number(8.8),
        "version": BigInt(1),
        "dt": new Date(),
        "isGood": Boolean(true),
        "file": new Int8Array([3, 255, 254, 253, 4]),
        "ar": [3, 4, { "id": 18, "nogood": false }, { "id": 19n, "vv": "OK" }],
    }
}
