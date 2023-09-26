// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert, fixed_prop} from "./util.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import Lookup from "./protocols/Lookup.mjs"
import Named from "./protocols/Named.mjs"

export default class QSym extends AbstractIdentifier {
    constructor(meta, fqn) {
        assert(fqn?.includes && fqn.includes("://"), `QSym must contain '://', got ${fqn}`)
        const url = new URL(fqn)
        const [pkg, mod] = decodeURI(url.pathname).split(":")
        const name = fqn.split(":").slice(-1)[0]
        super(meta, "", name, fqn)
        fixed_prop(this, "fqn", fqn)
        fixed_prop(this, "pkg", url.origin === "null" ? `${url.protocol}//${pkg}` : `${url.origin}${pkg}`)
        fixed_prop(this, "mod", mod)
    }

    with_meta(m) {
        return new this.constructor(m, this.fqn)
    }

    with_mod(mod_name) {
        this.constructor.parse(`${this.pkg}:${mod_name}`)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang", "qsym",
            [cg.literal(this, this.fqn)])
    }

    static parse(s) {
        return new this(null, s)
    }
}
