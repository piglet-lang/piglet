// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class, invoke_proto} from "./Protocol.mjs"

export default class SeqIterator {
    constructor(seq) {
        this.seq = seq
    }
    next() {
        if (this.seq) {
            const value = invoke_proto("bunny:lang/Seq", "-first", this.seq)
            this.seq = invoke_proto("bunny:lang/Seq", "-rest", this.seq)
            return {value: value, done: false}
        }
        return {value: void(0), done: true}
    }
    *[Symbol.iterator]() {
        return this
    }
}

extend_class(
    SeqIterator,
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
    [(function _first(self) {return invoke_proto("bunny:lang/Seq", "-first", self.seq)}),
     (function _rest(self) {return invoke_proto("bunny:lang/Seq", "-rest", self.seq)})],

    "bunny:lang/HasMeta",
    [(function _meta(self) {return self.meta})],

    "bunny:lang/Conjable",
    [(function _conj(self, o) {
        return new Cons(o, self.seq)})],

    "bunny:lang/Repr",
    [function _repr(self) { return self.repr() }])