// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Var from "./Var.mjs"

export default class Module {
    constructor(name) {
        this.name = name
        this.vars = {}
        this.aliases = {}
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

    isDefined(name) {
        return !!this.vars[name]
    }
}
