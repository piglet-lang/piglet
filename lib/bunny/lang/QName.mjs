// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class, invoke_proto} from "./Protocol.mjs"
import {assert} from "./util.mjs"

export class QName {
    constructor(fqn) {
        assert(fqn.includes("://"), "QName must contain '://'")
        this.fqn = fqn
    }

    repr() {
        return ":" + this.fqn
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "bunny", "lang", "qname",
            [cg.literal(this, this.fqn)])
    }
}

extend_class(
    QName,
    "bunny:lang/Repr",
    [function _repr(self) {return self.repr()}])

export class PrefixName {
    constructor(prefix, suffix) {
        assert(prefix === null || !prefix.includes(":"), "prefix can not contain a colon")
        assert(!suffix.includes(":"), "suffix can not contain a colon")
        this.prefix = prefix
        this.suffix = suffix
    }

    static parse(s) {
        assert(!s.includes("://"), "PrefixName can not contain '://'")
        const parts = s.split(":")
        assert(parts.length == 2, "PrefixName can only contain one colon")
        const [pre, suf] = parts
        return new this(pre, suf)
    }

    repr() {
        return ":" + (this.prefix ? this.prefix : "" + ":") + this.suffix
    }

    expand(context) {
        let uri = context[this.prefix]
        if (!uri) {
            throw new Error("Prefix not found in current context: " + this.prefix)
        }
        return new QName(uri + this.suffix)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "bunny",
            "lang",
            "prefix-name",
            [this.prefix, this.suffix].map(s=>cg.literal(this, s)))
    }

    with_prefix(prefix) {
        return Object.assign(new this.constructor(this.prefix, this.suffix), this, {prefix: prefix})
    }
}

extend_class(
    PrefixName,
    "bunny:lang/Repr",
    [function _repr(self) {return self.repr()}])

export class Context {
    constructor(entries) {
        this.entries = entries
    }

    expand(prefix_name) {
        let n = prefix_name.prefix
        let expanded_prefix
        while (expanded_prefix = this.entries[n]) {
            n = expanded_prefix
        }
        assert(n.indexOf("://") !== -1)
        return new QName(n + prefix_name.suffix)
    }

    contract(qname) {
        let prefix, suffix
        for (let k in this.entries) {
            let v = this.entries[k]
            if (qname.fqn.startsWith(v)) {
                prefix = k
                suffix = qname.fqn.slice(v.length)
                break
            }
        }
        return new PrefixName(prefix, suffix)
    }
}

// c = new Context({bunny: "https://npmjs.com/package/bunnylang/"})
// p = PrefixName.parse("bunny:foo")
// c.contract(c.expand(p))
