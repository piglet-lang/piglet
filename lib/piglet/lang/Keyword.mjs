// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class, invoke_proto} from "./Protocol.mjs"
import {meta, set_meta} from "./metadata.mjs"

const keywords = new Map()

export default class Keyword {
    constructor(name, meta) {
        this.name = name
        set_meta(this, meta)
    }

    repr() {
        return ":" + this.name
    }

    eq(other) {
        return (other instanceof Keyword) && this.name === other.name
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang",
            "keyword",
            (meta(this) ? [this.name, meta(this)] : [this.name]).map(s=>cg.literal(this, s)))
    }
}

export function keyword(name) {
    if(!keywords.has(name)) {
        keywords.set(name, new Keyword(name))
    }
    return keywords.get(name)
}

extend_class(
    Keyword,
    "piglet:lang/Repr",
    [function _repr(self) {return self.repr()}])
