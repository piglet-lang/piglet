// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class} from "./Protocol.mjs"
import {assert} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"

export default class Sym {
    constructor(pkg, mod, name, meta) {
        assert(name, "Sym's name can not be null")
        assert(!pkg || mod, "A Sym with a package must also declare a module")
        this.pkg = pkg || null
        this.mod = mod || null
        this.name = name
        set_meta(this, meta)
    }

    static parse(s) {
        const [a,b,c] = s.split(":")
        if (c) return new this(a,b,c)
        if (b) return new this(null,a,b)
        return new this(null,null,a)
    }

    repr() {
        let repr = this.name
        if (this.mod) repr = this.mod + ":" + repr
        if (this.pkg) repr = this.pkg + ":" + repr
        return repr
    }

    toString() {
        return this.repr()
    }

    eq(other) {
        return (other instanceof Sym) && this.name === other.name && this.mod === other.mod && this.pkg === other.pkg
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet",
            "lang",
            "symbol",
            (meta(this) ? [this.pkg, this.mod, this.name, meta(this)] : [this.pkg, this.mod, this.name]).map(s=>cg.literal(this, s)))
    }
}

extend_class(
    Sym,
    "piglet:lang/Eq",
    [function _$EQ$_(self, other) {
        return self.eq(other)}]
)
