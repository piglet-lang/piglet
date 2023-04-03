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
    }

    static unmunge(id) {
        return id
            .replaceAll("$$", ".")
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
                for (let [alias, ...pairs] of vals) {
                    let i = {alias: alias}
                    for (let [k, v] of partition_n(2, pairs)) {
                        i[k.name] = v
                    }
                    opts.imports.push(i)
                }
            }
        }
        console.log(opts)
        return new this(name.name, opts)
    }

    constructor(name, opts) {
        console.log(opts)
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

    intern(name, value, meta) {
        const munged = Module.munge(name)
        if (this.vars[munged]) {
            this.vars[munged].set_value(value)
            if (meta) {
                this.vars[munged].meta = meta
            }
            return this.vars[munged]
        } else {
            return this.vars[munged] = new Var(this.name, name, value, value, meta)
        }
    }

    has_var(name) {
        return !!this.vars[Module.munge(name)]
    }
}
