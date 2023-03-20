// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class List {
    constructor(elements) {
        this.elements = elements
    }

    first() {
        return this.elements[0]
    }

    rest() {
        return this.elements.slice(1)
    }

    eq(other) {
        if (!(other instanceof List)) return false
        let i1 = this[Symbol.iterator]
        let i2 = other[Symbol.iterator]

    }

    toString() {
        return "(" + this.elements.map(e=>e.toString()).join(" ") + ")"
    }

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }
}
