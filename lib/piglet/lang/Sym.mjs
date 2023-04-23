// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"

export default class Sym extends AbstractIdentifier {
    constructor(pkg, mod, name, meta) {
        assert(name, "Sym's name can not be null")
        assert(!pkg || mod, "A Sym with a package must also declare a module")

        let id_str = name
        if (mod) id_str = mod + ":" + id_str
        if (pkg) id_str = pkg + ":" + id_str
        super("",id_str)

        this.pkg = pkg || null
        this.mod = mod || null
        this.name = name
        set_meta(this, meta)
    }

    static parse(s, meta) {
        const [a,b,c] = s.split(":")
        if (c) return new this(a,b,c)
        if (b) return new this(null,a,b)
        return new this(null,null,a, meta)
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
            [cg.literal(this, this.pkg),
             cg.literal(this, this.mod),
             cg.literal(this, this.name),
             cg.emit(this, meta(this))])
    }
}
