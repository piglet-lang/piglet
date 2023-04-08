// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class, invoke_proto} from "./Protocol.mjs"

export const proto_eq = (a, b) => invoke_proto("bunny:lang/Eq", "=", a, b)

const proto_first = (o) => invoke_proto("bunny:lang/Seq", "-first", o)
const proto_rest = (o) => invoke_proto("bunny:lang/Seq", "-rest", o)

function seq_equiv(a, b) {
    let ra = a
    let rb = b
    if(ra === null && rb === null) {
        return true
    }
    let ha = proto_first(ra)
    let hb = proto_first(rb)
    while(proto_eq(ha, hb)) {
        ra = proto_rest(ra)
        rb = proto_rest(rb)
        if(ra === null && rb === null) {
            return true
        }
        ha = proto_first(ra)
        hb = proto_first(rb)
    }
    return false
}
