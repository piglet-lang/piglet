// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import {partition_n} from "./util.mjs"

/**
 * Naive copy-on-write dictionary backed by a frozen js Map. Placeholder since
 * it doesn't properly honour Piglet value semantics on keys, but works ok with
 * keywords since we intern those.
 */
export default class Dict {
    constructor(m) {
        this.entries = Object.freeze(m || new Map())
    }

    static of(...kvs) {
        const m = new Map()
        for (let [k, v] of partition_n(2, kvs)) {
            m.set(k, v)
        }
        return new this(m)
    }

    assoc(k, v) {
        return new Dict(new Map(this.entries).set(k, v))
    }

    dissoc(k) {
        return new Dict(new Map(this.entries).delete(k))
    }

    [Symbol.iterator]() {
        return this.entries[Symbol.iterator]()
    }

    has(k) {
        return this.entries.has(k)
    }

    get(k, v) {
        return this.has(k) ? this.entries.get(k) : v
    }

    keys() {
        return this.entries.keys()
    }

    values() {
        return this.entries.values()
    }

    emit(cg) {
        return cg.function_call(this,
                                cg.var_reference(this, new Sym("piglet", "lang", "dict")),
                                Array.from(this.entries).flatMap(([k, v])=>[cg.emit(this, k), cg.emit(this, v)]))
    }
}

export const EMPTY = new Dict([])

export function dict(...args) { return Dict.of(...args) }
