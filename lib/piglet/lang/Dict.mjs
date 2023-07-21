// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import {partition_n} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"
import {assert, fixed_prop} from "./util.mjs"
import Eq from "./protocols/Eq.mjs"
import Repr from "./protocols/Repr.mjs"

/**
 * Naive copy-on-write dictionary backed by a frozen js Map.
 */
export default class Dict {
    constructor(metadata, m) {
        assert(m instanceof Map, "Dict entries has to be js:Map")
        const self = function(key, fallback) {
            if (self.has(key)) return self.get(key)
            return fallback === undefined ? null : fallback
        }
        Object.setPrototypeOf(self, this.constructor.prototype)
        fixed_prop(self, "entries", Object.freeze(m || new Map()))
        if (metadata) set_meta(self, metadata)
        return self
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
        if (this.has(k)) {
            return new Dict(meta(this), new Map(this.dissoc(k).entries).set(k, v))
        }
        return new Dict(meta(this), new Map(this.entries).set(k, v))
    }

    dissoc(k) {
        const entries = new Map(this.entries)
        if (this.entries.has(k)) {
            entries.delete(k)
        } else if (Eq.satisfied(k)) {
            for (const [kk, vv] of this.entries.entries()) {
                if (Eq._eq(k, kk)) {
                    entries.delete(kk)
                }
            }
        }
        return new Dict(meta(this), entries)
    }

    with_meta(m) {
        return new Dict(m, this.entries)
    }

    [Symbol.iterator]() {
        return this.entries[Symbol.iterator]()
    }

    has(k) {
        if (this.entries.has(k)) {
            return true
        }
        if (Eq.satisfied(k)) {
            for (const [kk, vv] of this.entries.entries()) {
                if (Eq._eq(k, kk)) {
                    return true
                }
            }
        }
        return false
    }

    get(k, fallback) {
        if (this.entries.has(k)) {
            return this.entries.get(k)
        }
        if (Eq.satisfied(k)) {
            for (const [kk, vv] of this.entries.entries()) {
                if (Eq._eq(k, kk)) {
                    return vv
                }
            }
        }
        if (fallback === undefined) {
            return null
        }
        return fallback
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
        return cg.invoke_var(this,
                             "piglet", "lang", "dict",
                             Array.from(this.entries).flatMap(([k, v])=>[cg.emit(this, k), cg.emit(this, v)]))
    }

    inspect() {
        let recur = (v)=> (typeof v === 'object' || typeof v === 'function') && v?.inspect ? v.inspect() : Repr.satisfied(v) ? Repr._repr(v) : v
        return `Dict(${Array.from(this, (([k, v])=>`${recur(k)} ${recur(v)}`)).join(", ")})`
    }

    toJSON() {
        return this.entries
    }
}

export const EMPTY = new Dict(null, new Map())

Dict.EMPTY = EMPTY

export function dict(...args) { return Dict.of(null, ...args) }
