// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class, invoke_proto} from "./Protocol.mjs"
import SeqIterator from "./SeqIterator.mjs"

export default class Cons {
    constructor(x, xs) {
        this.x=x
        this.xs=xs
    }
    [Symbol.iterator]() {
        return new SeqIterator(this)
    }
    first() {
        return this.x
    }
    rest() {
        return this.xs
    }
    repr() {
        let r = "(" + invoke_proto("piglet:lang/Repr", "-repr", this.x)
        let rest = this.xs
        let count = 100
        while (rest) {
            r= r + " " + invoke_proto("piglet:lang/Repr", "-repr", invoke_proto("piglet:lang/Seq", "-first", rest))
            rest = invoke_proto("piglet:lang/Seq", "-rest", rest)
            count-=1
            if (count === 0) {
                r+= " ..."
                break
            }
        }
        return r + ")"
    }
}

extend_class(
    Cons,
    "piglet:lang/Eq",
    [function _$EQ$_(self, other) {
        const i1 = self[Symbol.iterator]()
        if (typeof other !== "object" || !(Symbol.iterator in other)) {
            return false
        }
        const i2 = other[Symbol.iterator]()
        var v1 = i1.next()
        var v2 = i2.next()
        while (invoke_proto("piglet:lang/Eq", "=", v1.value, v2.value) && !v1.done && !v2.done) {
            v1 = i1.next()
            v2 = i2.next()
        }
        return invoke_proto("piglet:lang/Eq", "=", v1.value, v2.value) && v1.done === v2.done}],

    "piglet:lang/Seq",
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})],

    "piglet:lang/Conjable",
    [(function _conj(self, o) {
        return new Cons(o, self)})],

    "piglet:lang/Repr",
    [function _repr(self) { return self.repr() }])
