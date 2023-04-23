// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Var from "./Var.mjs"
import {PrefixName} from "./QName.mjs"
import {partition_n} from "./util.mjs"
import {default_prefixes} from "./Context.mjs"
import {reset_meta} from "./metadata.mjs"
import {munge, unmunge} from "./util.mjs"

export default class Module {
    constructor(pkg, name, opts) {
        this.pkg = pkg
        this.name = name
        this.munged_id = munge(name)
        this.required = false
        this.vars = {}
        this.imports = opts?.imports || []
        this.aliases = {}
        for (let {alias, from} of this.imports) {
            this.aliases[alias.name] = from
        }
        this.context = opts?.context || {}
        Object.setPrototypeOf(this.context, default_prefixes)
    }

    static from(pkg, form) {
        const [_, name, ...more] = form
        const opts = {imports: []}
        for (let [kw,...vals] of more) {
            if (kw.name == "import") {
                for (let [alias, ...pairs] of vals) {
                    let i = {alias: alias}
                    for (let [k, v] of partition_n(2, pairs)) {
                        if (k?.constructor?.name == "Keyword" && k.name == "from") {
                            if (typeof v === 'string') {
                                i.from = v
                            } else {
                                i.from = v.prefix ? v : v.with_prefix("localpkg")
                            }
                        } else {
                            i[k.name] = v
                        }
                    }
                    opts.imports.push(i)
                }
            }
        }
        return new this(pkg, name.suffix, opts)
    }

    resolve(name) {
        return this.vars[munge(name)]
    }

    ensure_var(name) {
        const munged = munge(name)
        return this.vars[munged] ||= new Var(this.pkg, this.name, name, null, null, {})
    }

    intern(name, value, meta) {
        const the_var = this.ensure_var(name)
        the_var.set_value(value)
        if (meta !== undefined) {
            reset_meta(the_var, meta)
        }
        return the_var
    }

    has_var(name) {
        return !!this.vars[munge(name)]
    }

    set_alias(alias, mod) {
        this.aliases[alias] = new PrefixName(mod.pkg, mod.name)
    }

    repr() {
        return `${this.pkg}:${this.name}`
    }

    static munge(id) {return munge(id)}
    static unmunge(id) {return unmunge(id)}
}