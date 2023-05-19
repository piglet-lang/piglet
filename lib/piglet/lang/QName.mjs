// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert} from "./util.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import Lookup from "./protocols/Lookup.mjs"
import Named from "./protocols/Named.mjs"
import {fixed_prop} from "./util.mjs"

export default class QName extends AbstractIdentifier {
    constructor(meta, fqn) {
        assert(fqn.includes("://"), "QName must contain '://'")
        super(meta, ":", fqn, fqn)
        fixed_prop(this, 'fqn', fqn)
    }

    with_meta(m) {
        return new this.constructor(m, this.fqn)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang", "qname",
            [cg.literal(this, this.fqn)])
    }

    static parse(s) {
        return new this(null, s)
    }
}
