// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {meta, set_meta} from "./metadata.mjs"
import Lookup from "./protocols/Lookup.mjs"

const keywords = new Map()

export default class Keyword {
    constructor(name, meta) {
        this.name = name
        set_meta(this, meta)
    }

    with_meta(m) {
        return new this.constructor(this.name, m)
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

    call(_, arg, fallback) {
        if (fallback === undefined) {
            return Lookup._get(arg, this)
        }
        return Lookup._get(arg, this, fallback)
    }
}

export function keyword(name) {
    if(!keywords.has(name)) {
        keywords.set(name, new Keyword(name))
    }
    return keywords.get(name)
}
