// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Var from "./Var.mjs"

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
            .replaceAll(".", "$$$$")
    }

    constructor(name) {
        this.name = name
        this.munged_id = Module.munge(name)
        this.vars = {}
        this.aliases = {}
    }

    refer_module(other_module) {
        Object.assign(this.vars, other_module.vars)
    }

    resolve(name) {
        return this.vars[name]
    }

    intern(name, value) {
        if (this.vars[name]) {
            this.vars[name].set_value(value)
            return this.vars[name]
        } else {
            return this.vars[name] = new Var(this.name, name, value, value)
        }
    }

    has_var(name) {
        return !!this.vars[name]
    }
}
