// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Var from "./Var.mjs"
import {partition_n} from "./util.mjs"

export default class Module {
    // Attempt at a munging strategy which yields valid JS identifiers, and
    // which is unambiguosly reversible, i.e. does not create collisions
    static munge(id) {
        return id
            .replaceAll("$", "_$DOLLAR$_")
            .replaceAll("_", "_$UNDERSCORE$_")
            .replaceAll("-", "_")
            .replaceAll("+", "_$PLUS$_")
            .replaceAll("<", "_$LT$_")
            .replaceAll(">", "_$GT$_")
            .replaceAll("*", "_$STAR$_")
            .replaceAll("!", "_$BANG$_")
            .replaceAll("?", "_$QMARK$_")
            .replaceAll("&", "_$AMP$_")
            .replaceAll("%", "_$PERCENT$_")
            .replaceAll("=", "_$EQ$_")
            .replaceAll("|", "_$PIPE$_")
            .replaceAll("/", "_$SLASH$_")
            .replaceAll(".", "$$$$")
            .replaceAll("ː", "_$TRICOL$_")
            .replaceAll(":", "ː") // modifier letter triangular colon U+02D0
    }

    static unmunge(id) {
        return id
            .replaceAll("$$", ".")
            .replaceAll("ː", ":")
            .replaceAll("_$TRICOL$_", "ː")
            .replaceAll("_$SLASH$_", "/")
            .replaceAll("_$PIPE$_", "|")
            .replaceAll("_$EQ$_", "=")
            .replaceAll("_$PERCENT$_", "%")
            .replaceAll("_$AMP$_", "&")
            .replaceAll("_$QMARK$_", "?")
            .replaceAll("_$BANG$_", "!")
            .replaceAll("_$STAR$_", "*")
            .replaceAll("_$GT$_", ">")
            .replaceAll("_$LT$_", "<")
            .replaceAll("_$PLUS$_", "+")
            .replaceAll("_", "-")
            .replaceAll("_$UNDERSCORE$_", "_")
            .replaceAll("_$DOLLAR$_", "$")
    }

    static from(form) {
        const [_, name, ...more] = form
        const opts = {imports: []}
        for (let [kw,...vals] of more) {
            if (kw.name == "import") {
                // FIXME: the v.value call is because we get a Primitive
                // wrapping an array, we shouldn't have to deal with Primitive
                // wrappers here.
                for (let [alias, ...pairs] of vals.map(v=>v.value)) {
                    let i = {alias: alias}
                    for (let [k, v] of partition_n(2, pairs)) {
                        i[k.name] = v
                    }
                    opts.imports.push(i)
                }
            }
        }
        return new this(name.name, opts)
    }

    constructor(name, opts) {
        this.name = name
        this.munged_id = Module.munge(name)
        this.vars = {}
        this.aliases = {}
        this.imports = opts?.imports
    }

    refer_module(other_module) {
        Object.assign(this.vars, other_module.vars)
        return this
    }

    resolve(name) {
        return this.vars[Module.munge(name)]
    }

    ensure_var(name) {
        const munged = Module.munge(name)
        return this.vars[munged] ||= new Var(this.name, name, null, null, {})
    }

    intern(name, value, meta) {
        const the_var = this.ensure_var(name)
        the_var.set_value(value)
        if (meta !== void(0)) {
            the_var.set_meta(meta)
        }
        return the_var
    }

    has_var(name) {
        return !!this.vars[Module.munge(name)]
    }
}
