// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import AbstractSeq from "./AbstractSeq.mjs"
import {meta, set_meta} from "./metadata.mjs"
import Repr from "./protocols/Repr.mjs"

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

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }
    
    with_meta(m) {
        return set_meta(new List(Array.from(this.elements)), m)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet",
            "lang",
            "list-ctor",
            [cg.emit(this, meta(this) || null), ...Array.from(this, (e)=>cg.emit(this, e))])
    }

    inspect() {
        let recur = (v)=> (typeof v === 'object' || typeof v === 'function') && v?.inspect ? v.inspect() : Repr.satisfied(v) ? Repr._repr(v) : v
        return `List(${Array.from(this, recur).join(", ")})`
    }
}
