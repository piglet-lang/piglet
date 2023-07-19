// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import {partition_n} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"
import {assert, fixed_prop} from "./util.mjs"
import {hash_code} from "./hashing.mjs"
import Eq from "./protocols/Eq.mjs"
import Repr from "./protocols/Repr.mjs"

export {hash_code}

function eq(thiz, that) {
    if (thiz === that) return true
    if (hash_code(thiz) !== hash_code(that)) return false
    if (Eq.satisfied(thiz)) return Eq._eq(thiz, that)
    return false
}

function arr_has(arr, o) {
    for (const a of arr) {
        if (eq(a, o)) return true
    }
    return false
}

function madd(m, o) {
    const hsh = hash_code(o)
    if (!m.has(hsh)) m.set(hsh, [])
    const bucket = m.get(hsh)
    if (!arr_has(bucket, o))
        bucket.push(o)
    return m
}

function mremove(m, o) {
    const hsh = hash_code(o)
    if (m.has(hsh)) {
        m.set(hsh, m.get(hsh).filter((x)=>!eq(x,o)))
    }
    return m
}

function mhas(m, o) {
    const hsh = hash_code(o)
    if(m.has(hsh))
        for (const x of m.get(hsh))
            if (eq(x,o)) return true
    return false
}

/**
 * Naive copy-on-write set by a frozen js Map. Placeholder since it doesn't
 * properly honour Piglet value semantics on keys, but works ok with keywords
 * since we intern those.
 */
export default class HashSet {
    constructor(metadata, m) {
        assert(m instanceof Map, "HashSet entries has to be js:Map")
        const self = function(value, fallback) {
            if (self.has(value)) return value
            return fallback === undefined ? null : fallback
        }
        Object.setPrototypeOf(self, this.constructor.prototype)
        fixed_prop(self, "entries", Object.freeze(m || new Map()))
        if (metadata) {
            set_meta(self, metadata)
        }
        self._count = Array.from(self.entries.values()).reduce((acc,bucket)=>acc+bucket.length, 0)
        return self
    }

    static of(meta, ...values) {
        const m = new Map()
        for (const o of values) madd(m, o)
        return new this(meta, m)
    }

    conj(o) {
        if (this.has(o)) return this
        return new HashSet(meta(this), madd(new Map(this.entries), o))
    }

    disj(o) {
        if (this.has(o)) return new HashSet(meta(this), mremove(new Map(this.entries), o))
        return this
    }

    with_meta(m) {
        return new HashSet(m, this.entries)
    }

    [Symbol.iterator]() {
        const map_it = this.entries[Symbol.iterator]()
        let map_res = map_it.next()
        let bucket_it = null
        let bucket_res = null
        const next = function next() {
            // Get a new bucket_it, or decide that we're done
            if (!bucket_it || bucket_res.done) {
                if (map_res.done) {
                    return {done: true}
                }
                bucket_it = map_res.value[1][Symbol.iterator]()
                map_res = map_it.next()
            }
            // at this point we must have a bucket iterator
            bucket_res = bucket_it.next()
            // We're at the end of the bucket, retry with the next
            if (bucket_res.done) return next()
            return bucket_res
        }
        return {next: next}
    }

    has(o) {
        return mhas(this.entries, o)
    }

    count() {
        return this._count
    }

    emit(cg) {
        return cg.invoke_var(this,
            "piglet", "lang", "set-ctor",
            [
                cg.emit(this, meta(this) || null),
                ...Array.from(this).map((o)=>cg.emit(this, o))
            ])
    }

    inspect() {
        let recur = (v)=> (typeof v === 'object' || typeof v === 'function') && v?.inspect ? v.inspect() : Repr.satisfied(v) ? Repr._repr(v) : v
        return `HashSet(${Array.from(this, ((o)=>`${recur(o)}`)).join(", ")})`
    }

    toJSON() {
        return Array.from(this.entries.values).reduce((acc, bucket)=>acc+bucket, [])
    }
}

export const EMPTY = new HashSet(null, new Map())

HashSet.EMPTY = EMPTY

export function set(coll) { return HashSet.of(meta(coll), ...coll) }
