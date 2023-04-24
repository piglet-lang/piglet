// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert} from "./util.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import Lookup from "./protocols/Lookup.mjs"
import Named from "./protocols/Named.mjs"

export default class QName extends AbstractIdentifier {
    constructor(fqn) {
        assert(fqn.includes("://"), "QName must contain '://'")
        super(":", fqn)
        this.fqn = fqn
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang", "qname",
            [cg.literal(this, this.fqn)])
    }

    call(_, arg, fallback) {
        if (fallback === undefined) {
            return Lookup._get(arg, this)
        }
        return Lookup._get(arg, this, fallback)
    }
}
