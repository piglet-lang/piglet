// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert, fixed_prop} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import QSym from "./QSym.mjs"

const CACHE = {}

/**
 * Identifier with up to three components: `pkg:mod:name`. If fewer components
 * are given, then they anchor towards the end. So `pkg` can be nil, or `pkg` and
 * `mod` can both be nil. `name` must always be present.
 *
 * Generally used to refer to a var within a module within a package, hence
 * these names. But in some places we use syms to identify modules (e.g. in a
 * module form's `:import` declaration), in which case `pkg` will be `nil`,
 * `mod` identifies a package alias, and `name` identifies the module.
 */
export default class Sym extends AbstractIdentifier {
    constructor(pkg, mod, name, meta) {
        assert(name, "Sym's name can not be null")
        assert(!pkg || mod, "A Sym with a package must also declare a module")

        let id_str = name
        if (mod) id_str = mod + ":" + id_str
        if (pkg) id_str = pkg + ":" + id_str
        super(meta || null, "", name, id_str)

        fixed_prop(this, "pkg", pkg || null)
        fixed_prop(this, "mod", mod || null)
    }

    static parse(s, meta) {
        if (s.includes("://")) {
            return QSym.parse(s)
        }
        const [a,b,c] = s.split(":")
        if (meta == null) {
            const sym = CACHE[s]
            if (sym) return sym
        }
        const sym = (c ? new this(a,b,c, meta || null) :
                     b ? new this(null,a,b, meta || null) :
                     new this(null, null, a, meta || null))
        if (meta == null) CACHE[s] = sym
        return sym
    }

    eq(other) {
        return (other instanceof Sym) && this.name === other.name && this.mod === other.mod && this.pkg === other.pkg
    }

    with_mod(m) {
        return new this.constructor(this.pkg, m, this.name, meta(this))
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

export function symbol(pkg, mod, name, metadata) {
    if (arguments.length === 1) {
        return Sym.parse(pkg, metadata)
    }
    return new Sym(pkg, mod, name, metadata)
}
