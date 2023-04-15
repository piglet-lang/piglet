// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Cons from "./Cons.mjs"
import {extend_class, invoke_proto} from "./Protocol.mjs"
import Repr from "./protocols/Repr.mjs"

const proto_repr = e => invoke_proto("piglet:lang/Repr", "-repr", e)

export default class IteratorSeq {
    constructor(iterator, value, done) {
        this.value = value
        this.done = done
        this._rest = null
        this.iterator = iterator
    }

    static of(iterator) {
        const {value, done} = iterator.next()
        return new this(iterator, value, done)
    }

    repr() {
        return `(${Array.from(this).map(proto_repr).join(" ")})`
    }

    first() {
        return this.value
    }

    rest() {
        if (this._rest) {
            return this.rest
        }
        const {value, done} = this.iterator.next()
        if (done) {
            return null
        }
        this._rest = new this.constructor(this.iterator, value, done)
        return this._rest
    }

    [Symbol.iterator]() {
        let head = this.done ? null : this
        return {next: ()=>{
            if(!head) {
                return {value: null, done: true}
            }
            const ret = {value: head.value,
                         done: head.done}
            head = head.rest()
            return ret
        }}
    }
}

extend_class(
    IteratorSeq,
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
        return new Cons(o, self)})]
)

Repr.extend(IteratorSeq, [function _repr(self) { return self.repr() }])
