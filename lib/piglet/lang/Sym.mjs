// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert, fixed_props} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import QSym from "./QSym.mjs"

export default class Sym extends AbstractIdentifier {
    constructor(pkg, mod, name, meta) {
        assert(name, "Sym's name can not be null")
        assert(!pkg || mod, "A Sym with a package must also declare a module")

        let id_str = name
        if (mod) id_str = mod + ":" + id_str
        if (pkg) id_str = pkg + ":" + id_str
        super(meta, "", name, id_str)

        fixed_props(this, {pkg: pkg || null,
                           mod: mod || null})
    }

    static parse(s, meta) {
        if (s.includes("://")) {
            return QSym.parse(s)
        }
        const [a,b,c] = s.split(":")
        if (c) return new this(a,b,c)
        if (b) return new this(null,a,b)
        return new this(null, null, a, meta)
    }

    eq(other) {
        return (other instanceof Sym) && this.name === other.name && this.mod === other.mod && this.pkg === other.pkg
    }

    with_meta(m) {
        return new this.constructor(this.pkg, this.mod, this.name, m)
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
