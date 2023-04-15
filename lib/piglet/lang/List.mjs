// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import {extend_class, invoke_proto} from "./Protocol.mjs"

import Repr from "./protocols/Repr.mjs"

export default class List {
    constructor(elements) {
        this.elements = elements
    }

    first() {
        return this.elements[0]
    }

    rest() {
        if (this.elements.length > 1) {
            return new List(this.elements.slice(1))
        }
        return null
    }

    repr() {
        return `(${this.elements.map((e)=>Repr._repr(e)).join(" ")})`
    }

    emit(cg) {
        return cg.function_call(this,
                                cg.var_reference(this, new Sym("piglet", "lang", "list")),
                                this.elements.map(e=>e.emit(cg)))
    }

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }
}

extend_class(
    List,
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
        const elements = Array.from(self)
        elements.unshift(o)
        return new self.constructor(elements)})]
)

Repr.extend(Sym, [function _repr(self) { return self.repr() }])
