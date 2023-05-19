// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert, fixed_props} from "./util.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import Lookup from "./protocols/Lookup.mjs"
import Named from "./protocols/Named.mjs"

export default class QSym extends AbstractIdentifier {
    constructor(fqn) {
        assert(fqn.includes("://"), "QSym must contain '://'")
        super("", fqn)
        const [scheme, pkg, mod, name] = fqn.split(":")
        fixed_props(
            this,
            {fqn: fqn,
             pkg: `${scheme}:${pkg}`,
             mod: mod,
             name: name})
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang", "qsym",
            [cg.literal(this, this.fqn)])
    }

    static parse(s) {
        return new QSym(s)
    }
}
