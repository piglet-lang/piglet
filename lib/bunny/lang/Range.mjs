// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import Cons from "./Cons.mjs"
import {extend_class, invoke_proto} from "./Protocol.mjs"

export default class Range {
    constructor(from, to, step, meta) {
        this.from = to ? from : 0
        this.to = to ? to : from
        this.step = step || 1
        this.meta = meta
    }

    [Symbol.iterator]() {
        if (!this.to) {
            throw new Error("Can't get range iterator for infinte range")
        }
    }

    first() {
        return this.from
    }

    rest() {
        if ((this.from + this.step) < this.to) {
            return new Range(this.from+this.step, this.to, this.step)
        }
        return null
    }

    repr() {
        return "#range (" + this.from + " " + this.to + (this.step === 1 ? "" : (""+this.step)) + ")"
    }
}

extend_class(
    Range,
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
        return new Cons(o, self)})],

    "bunny:lang/Repr",
    [function _repr(self) { return self.repr() }])
