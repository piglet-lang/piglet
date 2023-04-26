// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Var from "./Var.mjs"
import PrefixName from "./PrefixName.mjs"
import {partition_n} from "./util.mjs"
import Context, {DEFAULT_CONTEXT} from "./Context.mjs"
import {reset_meta} from "./metadata.mjs"
import {munge, unmunge} from "./util.mjs"
import {dict} from "./Dict.mjs"

export default class Module {
    constructor(opts) {
        this.required = false
        this.vars = {}
        this.set_opts(opts)
    }

    static parse_opts(current_pkg, form) {
        const [_, name, ...more] = form
        // console.log(`Module.parse_opts(${current_pkg}, ${name.inspect()})`)
        let opts = dict("pkg", name.prefix, "name", name.suffix, "imports", [], "context", null)
        for (let [kw,...vals] of more) {
            if (kw.name == "import") {
                for (let [alias, ...pairs] of vals) {
                    let i = {alias: alias}
                    for (let [k, v] of partition_n(2, pairs)) {
                        if (k?.constructor?.name == "Keyword" && k.name == "from") {
                            if (typeof v === 'string') {
                                i.from = v
                            } else {
                                i.from = v.prefix ? v : v.with_prefix(current_pkg)
                            }
                        } else {
                            i[k.name] = v
                        }
                    }
                    opts.get("imports").push(i)
                }
            }
            if (kw.name == "context") {
                opts = opts.assoc("context", vals[0])
            }

        }
        return opts
    }

    static from(pkg, form) {
        // console.log(`Module.from(${pkg}, ${Array.from(form)[1].inspect()})`)
        return new this(this.parse_opts(pkg, form))
    }

    set_opts(opts) {
        this.pkg = opts?.get("pkg")
        this.name = opts?.get("name")
        this.munged_id = munge(this.name)
        this.imports = opts?.get("imports") || []
        this.aliases = {}
        for (let {alias, from} of this.imports) {
            this.aliases[alias.name] = from
        }
        this.context = new Context((opts?.get("context") || dict()).assoc("self", `https://piglet-lang.org/pkg/${opts.get("pkg")}/`), DEFAULT_CONTEXT)
    }

    resolve(name) {
        // console.log("Resolving", this.repr(), name, !! this.vars[munge(name)])
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

    inspect() {
        return `Module(${this.pkg}, ${this.name}, ${Object.entries(this.aliases).map(([k, v])=>''+k+'=>'+v.inspect()).join("; ")})`
    }
}
