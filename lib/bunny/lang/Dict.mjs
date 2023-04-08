// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class, invoke_proto} from "./Protocol.mjs"

/**
 * Naive copy-on-write dictionary backed by a frozen js Map.
 */
export default class Dict {
    constructor(m) {
        this.entries = Object.freeze(m || new Map())
    }

    assoc(k, v) {
        return new Dict(new Map(this.entries).set(k, v))
    }

    dissoc(k) {
        return new Dict(new Map(this.entries).delete(k))
    }

    [Symbol.iterator]() {
        this.entries[Symbol.iterator]()
    }

    has_key(k) {
        this.entries.has(k)
    }

    get(k, v) {
        return this.has_key(k) ? this.get(k) : v
    }

    keys() {
        return this.entries.keys()
    }

    vals() {
        return this.entries.vals()
    }
}

export const EMPTY = new Dict([])

extend_class(
    List,
    "bunny:lang/Eq",
    [function _$EQ$_(self, other) {
        const i1 = self[Symbol.iterator]()
        if (typeof other !== "object" || !(Symbol.iterator in other)) {
            return false
        }
        const i2 = other[Symbol.iterator]()
        var v1 = i1.next()
        var v2 = i2.next()
        while (invoke_proto("bunny:lang/Eq", "=", v1.value, v2.value) && !v1.done && !v2.done) {
            v1 = i1.next()
            v2 = i2.next()
        }
        return invoke_proto("bunny:lang/Eq", "=", v1.value, v2.value) && v1.done === v2.done}],

    "bunny:lang/Seq",
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})],

    "bunny:lang/HasMeta",
    [(function _meta(self) {return self.meta})],

    "bunny:lang/Conjable",
    [(function _conj(self, o) {
        const elements = Array.from(self)
        elements.unshift(o)
        return new self.constructor(elements)})],

    "bunny:lang/Repr",
    [function _repr(self) { return self.repr() }])
