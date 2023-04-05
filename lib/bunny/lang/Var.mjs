// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class Var {
    constructor(pkg, module, name, value, meta) {
        this.pkg = pkg
        this.module = module
        this.name = name
        this.value = value
        this.binding_stack = []
        this.meta = meta
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

    set_meta(m) {
        this.meta = m
        return this
    }

    push_binding(value) {
        this.binding_stack.unshift(this.value)
        this.value = value
    }

    pop_binding() {
        this.value = this.binding_stack.shift()
    }
}
