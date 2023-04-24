// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import {partition_n} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"
import {assert} from "./util.mjs"

/**
 * Naive copy-on-write dictionary backed by a frozen js Map. Placeholder since
 * it doesn't properly honour Piglet value semantics on keys, but works ok with
 * keywords since we intern those.
 */
export default class Dict {
    constructor(metadata, m) {
        assert(m instanceof Map, "Dict entries has to be js:Map")
        this.entries = Object.freeze(m || new Map())
        if (metadata) {
            set_meta(this, metadata)
        }
    }

    static of(meta, ...kvs) {
        const m = new Map()
        for (let [k, v] of partition_n(2, kvs)) {
            m.set(k, v)
        }
        return new this(meta, m)
    }

    static of_pairs(meta, kvs) {
        const m = new Map()
        for (let [k, v] of kvs) {
            m.set(k, v)
        }
        return new this(meta, m)
    }

    assoc(k, v) {
        return new Dict(meta(this), new Map(this.entries).set(k, v))
    }

    dissoc(k) {
        const entries = new Map(this.entries)
        entries.delete(k)
        return new Dict(meta(this), entries)
    }

    with_meta(m) {
        return new Dict(m, this.entries)
    }

    [Symbol.iterator]() {
        return this.entries[Symbol.iterator]()
    }

    has(k) {
        return this.entries.has(k)
    }

    get(k, v) {
        return this.has(k) ? this.entries.get(k) : (v === undefined) ? null : v
    }

    keys() {
        return this.entries.keys()
    }

    values() {
        return this.entries.values()
    }

    count() {
        return this.entries.size
    }

    emit(cg) {
        return cg.function_call(this,
                                cg.var_reference(this, new Sym("piglet", "lang", "dict-ctor")),
                                [cg.emit(this, meta(this) || null)].concat(
                                    Array.from(this.entries).flatMap(([k, v])=>[cg.emit(this, k), cg.emit(this, v)])))
    }
}

export const EMPTY = new Dict(null, new Map())

Dict.EMPTY = EMPTY

export function dict(...args) { return Dict.of(null, ...args) }
