// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class} from "./Protocol.mjs"

export default class Sym {
    constructor(ns, name, meta) {
        this.namespace = ns
        this.name = name
        this.meta = meta
    }

    repr() {
        if (this.namespace) {
            return this.namespace + "/" + this.name
        } else {
            return this.name
        }
    }

    eq(other) {
        return (other instanceof Sym) && this.namespace === other.namespace && this.name === other.name
    }

    namespaced() {
        return !!this.namespace;
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "bunny:lang",
            "symbol",
            (this.meta ? [this.name, this.namespace, this.meta] : [this.namespace, this.name]).map(s=>cg.literal(this, s)))
    }
}

extend_class(
    Sym,
    "bunny:lang/Eq",
    [function _$EQ$_(self, other) {
        return self.eq(other)}],

    "bunny:lang/Repr",
    [function _repr(self) { return self.repr() }],

    "bunny:lang/HasMeta",
    [(function _meta(self) {return self.meta})])
