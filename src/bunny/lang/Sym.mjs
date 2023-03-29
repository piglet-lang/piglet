// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class Sym {
    constructor(ns, name, meta) {
        this.namespace = ns
        this.name = name
        this.meta = meta
    }

    toString() {
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
            "bunny.lang",
            "symbol",
            (this.meta ? [this.name, this.namespace, this.meta] : [this.namespace, this.name]).map(s=>cg.literal(this, s)))
    }
}
