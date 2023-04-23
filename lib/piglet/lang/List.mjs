// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import AbstractSeq from "./AbstractSeq.mjs"

export default class List extends AbstractSeq {
    constructor(elements) {
        super()
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

    seq() {
        return this.empty_p() ? null : this
    }

    empty_p() {
        return this.elements.length == 0
    }

    count() {
        return this.elements.length
    }

    conj(el) {
        const elements = [...this]
        elements.unshift(el)
        return new this.constructor(elements)
    }

    emit(cg) {
        return cg.function_call(this,
                                cg.var_reference(this, new Sym("piglet", "lang", "list")),
                                this.elements.map(e=>cg.emit(e)))
    }

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }
}
