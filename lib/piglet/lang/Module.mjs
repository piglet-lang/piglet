// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Var from "./Var.mjs"
import PrefixName from "./PrefixName.mjs"
import Keyword from "./Keyword.mjs"
import Sym from "./Sym.mjs"
import QSym from "./QSym.mjs"
import {partition_n, fixed_props, assert, assert_type, gensym} from "./util.mjs"
import Context from "./Context.mjs"
import {reset_meta} from "./metadata.mjs"
import {munge, unmunge} from "./util.mjs"
import {dict} from "./Dict.mjs"

export default class Module {
    constructor(opts) {
        this.required = false
        this.set_opts(opts)
    }

    set_opts(opts) {
        const name = opts?.get("name")
        const pkg = opts.get("package")
        assert(pkg, opts)
        fixed_props(
            this,
            {package: pkg,
             pkg: pkg.name,
             name: name,
             munged_id: munge(name),
             fqn: QSym.parse(`${pkg.name}:${name}`),
             imports: opts?.get("imports") || [],
             aliases: {},
             vars: {}})

        this.self_ref = gensym(`mod-${name}`)

        if (opts.get('location')) {
            this.location = opts.get('location')
        }

        for (const {alias, from} of this.imports) {
            this.set_alias(alias.name, from)
        }
        this.context = (opts?.get("context") || dict()).assoc("self", this.pkg)
    }

    /**
     * Takes the current package name (string), and a `(module ...)` form, and
     * returns a dict with parsed module attributes (as string keys)
     * - name
     * - imports
     * - context
     */
    static parse_opts(current_pkg, form) {
        const [_, name, ...more] = form
        // console.log(`Module.parse_opts(${current_pkg}, ${name.inspect()})`)
        let opts = dict("name", name.name, "imports", [], "context", null)
        for (let [kw,...vals] of more) {
            if (kw.name == "import") {
                for (let [alias, ...pairs] of vals) {
                    let i = {alias: alias}
                    for (let [k, v] of partition_n(2, pairs)) {
                        i[k.name] = v
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

    merge_opts(opts) {
        Object.assign(this.imports, opts?.get("imports"))
        for (const {alias, from} of this.imports) {
            this.set_alias(alias.name, from)
        }
        this.context = (opts?.get("context") || dict()).assoc("self", `${this.pkg}#`)
    }

    resolve(name) {
        // console.log("Resolving", this.repr(), name, !! this.vars[munge(name)])
        return this.vars[munge(name)]
    }

    ensure_var(name, meta) {
        const munged = munge(name)
        if (!Object.hasOwn(this.vars, name)) {
            this.vars[munged] = new Var(this.pkg, this.name, name, null, null, meta)
        }
        return this.vars[munged]
    }

    intern(name, value, meta) {
        const the_var = this.ensure_var(name, meta)
        the_var.set_value(value)
        if (meta !== undefined) {
            if (meta?.constructor == Object) {
                meta = Object.entries(meta).reduce((acc,[k,v])=>acc.assoc(k, v), dict())
            }
            reset_meta(the_var, meta)
        }
        return the_var
    }

    has_var(name) {
        return !!this.vars[munge(name)]
    }

    set_alias(alias, mod) {
        assert_type(mod, Module, `Alias should point to Module, got ${mod?.constructor || typeof mod}`)
        this.aliases[alias] = mod
        this.intern(alias, mod)
    }

    resolve_alias(alias) {
        return this.aliases[alias]
    }

    repr() {
        return `${this.pkg}:${this.name}`
    }

    static munge(id) {return munge(id)}
    static unmunge(id) {return unmunge(id)}

    inspect() {
        return `Module(${this.pkg}:${this.name})`
    }

    // DictLike
    keys() { return Array.from(Object.keys(this.vars), (k)=>new Sym(null, null, unmunge(k), null))}
    vals() { return Object.values(this.vars)}
    lookup(k) { return this.vars[munge(k)] }
    seq() {
        if (Object.keys(this.vars).length === 0) return null
        return Array.from(Object.entries(this.vars), ([k, v])=>[new Sym(null, null, unmunge(k), null), v])
    }
}
