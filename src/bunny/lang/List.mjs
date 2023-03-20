// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {method_call, var_lookup} from "./estree_helpers.mjs"

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

    estree() {
        return {type: "CallExpression",
                callee: var_lookup("bunny.lang", "list"),
                arguments: this.elements.map(e=>e.estree())}
    }

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }
}
