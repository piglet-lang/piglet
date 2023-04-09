// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class} from "./Protocol2.mjs"
import {partition_n} from "./util.mjs"

/**
 * Naive copy-on-write dictionary backed by a frozen js Map.
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

    has_key(k) {
        return this.entries.has(k)
    }

    get(k, v) {
        return this.has_key(k) ? this.entries.get(k) : v
    }

    keys() {
        return this.entries.keys()
    }

    vals() {
        return this.entries.vals()
    }
}

export const EMPTY = new Dict([])

export function dict(...args) { return Dict.of(...args) }

// const proto_eq = (a, b) => invoke_proto("bunny:lang/Eq", "=", a, b)
// const proto_seq = (o) => invoke_proto("bunny:lang/Seq", "-seq", o)
// const proto_keys = (m) => invoke_proto("bunny:lang/MapLike", "-keys", m)
// const is_map = (o) => satisfied("bunny:lang/MapLike", o)

extend_class(
    Dict,
    "bunny:lang:DictLike",
    [function _keys(d) {return d.keys()},
     function _vals(d) {return d.vals()}]
)

// extend_class(
//     Dict,
//     "bunny:lang/Eq",
//     [function _$EQ$_(self, other) {
//         throw new Error("not implemente")}],

//     "bunny:lang/Seq",
//     [(function _first(self) {return self.first()}),
//      (function _rest(self) {return self.rest()})],

//     "bunny:lang/HasMeta",
//     [(function _meta(self) {return self.meta})],

//     "bunny:lang/Conjable",
//     [(function _conj(self, o) {
//         const elements = Array.from(self)
//         elements.unshift(o)
//         return new self.constructor(elements)})],

//     "bunny:lang/Repr",
//     [function _repr(self) { return self.repr() }])
