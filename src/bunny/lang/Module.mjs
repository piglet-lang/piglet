// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Var from "./Var.mjs"

export default class Module {
    constructor(name) {
        this.name = name
        this.vars = {}
        this.aliases = {}
    }

    get_var(name) {
        return this.vars[name] || (this.vars[name] = new Var(this.name, name, null, null))
    }

    isDefined(name) {
        return !!this.vars[name]
    }
}
