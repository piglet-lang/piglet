// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import {extend_class} from "./Protocol.mjs"

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

    toString() {
        return "(" + this.elements.map(e=>e.toString()).join(" ") + ")"
    }

    emit(cg) {
        return cg.function_call(this,
                                cg.var_reference(this, new Sym("bunny.lang", "list")),
                                this.elements.map(e=>e.emit(cg)))
    }

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }
}

extend_class(
    List, "bunny.lang/Seq",
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})]
)

extend_class(
    List, "bunny.lang/HasMeta",
    [(function _meta(self) {return self.meta})]
)

extend_class(
    List, "bunny.lang/Conjable",
    [(function _conj(self, o) {
        const elements = Array.from(self)
        elements.unshift(o)
        return new self.constructor(elements)
    })]
)
