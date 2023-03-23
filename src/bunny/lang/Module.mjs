// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Var from "./Var.mjs"

export default class Module {
    // Attempt at a munging strategy which yields valid JS identifiers, and
    // which is unambiguosly reversible, i.e. does not create collisions
    static munge(id) {
        console.log(id)
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
        return this.vars[Module.munge(name)]
    }

    intern(name, value) {
        console.log(name)
        const munged = Module.munge(name)
        if (this.vars[munged]) {
            this.vars[munged].set_value(value)
            return this.vars[munged]
        } else {
            return this.vars[munged] = new Var(this.name, name, value, value)
        }
    }

    has_var(name) {
        return !!this.vars[Module.munge(name)]
    }
}
