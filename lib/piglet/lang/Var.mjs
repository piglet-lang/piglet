// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {meta, set_meta_mutable} from "./metadata.mjs"
import Repr from "./protocols/Repr.mjs"

export default class Var {
    constructor(pkg, module, name, value, _meta) {
        const self = {[name](...args) {
            try {
                return self.value(...args)
            } catch (e) {
                e.stack = `    at ${self.repr()} ${Repr._repr(meta(self))}\n${e.stack}`
                throw e
            }
        }}[name]
        Object.setPrototypeOf(self, Var.prototype)
        self.pkg = pkg
        self.module = module
        self.value = value
        self.binding_stack = []
        set_meta_mutable(self, _meta)
        return self
    }

    deref() {
        return this.value
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

    toString() {
        return this.repr()
    }

    inspect() {
        return `Var(${this.toString()})`
    }
}

Object.setPrototypeOf(Var.prototype, Function)
