// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert} from "./util.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import Lookup from "./protocols/Lookup.mjs"

export default class PrefixName extends AbstractIdentifier {
    constructor(meta, prefix, suffix) {
        assert(prefix === null || !prefix.includes(":"), "prefix can not contain a colon")
        assert(!suffix.includes(":"), "suffix can not contain a colon")
        super(meta, ":", suffix, `${prefix || ""}:${suffix}`)
        this.prefix = prefix
        this.suffix = suffix
    }

    static parse(s) {
        assert(!s.includes("://"), "PrefixName can not contain '://'")
        const parts = s.split(":")
        assert(parts.length == 2, "PrefixName can only contain one colon")
        const [pre, suf] = parts
        return new this(null, pre, suf)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet",
            "lang",
            "prefix-name",
            [this.prefix, this.suffix].map(s=>cg.literal(this, s)))
    }

    with_prefix(prefix) {
        return Object.assign(new this.constructor(this.prefix, this.suffix), this, {prefix: prefix})
    }

    with_meta(m) {
        return new this.constructor(m, this.prefix, this.suffix)
    }

    call(_, arg, fallback) {
        if (fallback === undefined) {
            return Lookup._get(arg, this)
        }
        return Lookup._get(arg, this, fallback)
    }

    inspect() {
        return `PrefixName(:${this.prefix}:${this.suffix})`
    }
}
