// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"

export default class List {
    constructor(elements) {
        this.elements = elements
    }

    first() {
        return this.elements[0]
    }

    rest() {
        return new List(this.elements.slice(1))
    }

    eq(other) {
        if (!(other instanceof List)) return false
        let i1 = this[Symbol.iterator]
        let i2 = other[Symbol.iterator]

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
