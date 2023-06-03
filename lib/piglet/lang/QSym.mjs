// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert, fixed_props} from "./util.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import Lookup from "./protocols/Lookup.mjs"
import Named from "./protocols/Named.mjs"

export default class QSym extends AbstractIdentifier {
    constructor(meta, fqn) {
        assert(fqn?.includes && fqn.includes("://"), `QSym must contain '://', got ${fqn}`)
        const [scheme, pkg, mod, name] = fqn.split(":")
        super(meta, "", name, fqn)
        fixed_props(
            this,
            {fqn: fqn,
             pkg: `${scheme}:${pkg}`,
             mod: mod})
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
