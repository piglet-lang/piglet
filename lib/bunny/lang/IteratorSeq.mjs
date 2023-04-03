// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Cons from "./Cons.mjs"
import {extend_class, invoke_proto} from "./Protocol.mjs"

export default class IteratorSeq {
    constructor(iterator, value, done) {
        this.value = value
        this.done = done
        this.iterator = iterator
    }

    static of(iterator) {
        const {value, done} = iterator.next()
        return new this(iterator, value, done)
    }

    repr() {
        return "(" + Array.from(this.iterator).map(e=>invoke_proto("bunny.lang/Repr", "-repr", e)).join(" ") + ")"
    }

    first() {
        return this.value
    }

    rest() {
        const {value, done} = this.iterator.next()
        if (done) {
            return null
        }
        return new this.constructor(this.iterator, value, done)
    }
}

extend_class(
    IteratorSeq,
    "bunny.lang/Eq",
    [function _$EQ$_(self, other) {
        const i1 = self[Symbol.iterator]()
        if (typeof other !== "object" || !(Symbol.iterator in other)) {
            return false
        }
        const i2 = other[Symbol.iterator]()
        var v1 = i1.next()
        var v2 = i2.next()
        while (invoke_proto("bunny.lang/Eq", "=", v1.value, v2.value) && !v1.done && !v2.done) {
            v1 = i1.next()
            v2 = i2.next()
        }
        return invoke_proto("bunny.lang/Eq", "=", v1.value, v2.value) && v1.done === v2.done}],

    "bunny.lang/Seq",
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})],

    "bunny.lang/HasMeta",
    [(function _meta(self) {return self.meta})],

    "bunny.lang/Conjable",
    [(function _conj(self, o) {
        return new Cons(o, self)})],

    "bunny.lang/Repr",
    [function _repr(self) { return self.repr() }])
