// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {set_meta_mutable} from "./metadata.mjs"
import Repr from "./protocols/Repr.mjs"

export default class Var {
    constructor(pkg, module, name, value, meta) {
        this.pkg = pkg
        this.module = module
        this.name = name
        this.value = value
        this.binding_stack = []
        set_meta_mutable(this, meta)
    }

    deref() {
        return this.value
    }

    invoke(...args) {
        return this.value(...args)
    }

    set_value(value) {
        this.value = value
        return this
    }

    push_binding(value) {
        this.binding_stack.unshift(this.value)
        this.value = value
    }

    pop_binding() {
        this.value = this.binding_stack.shift()
    }

    repr() {
        return `#'${this.module}:${this.name}`
    }
}

Repr.extend(Var, [function _repr(self) { return self.repr() }])
