// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class Var {
    constructor(module, name, value, meta) {
        this.module = module
        this.name = name
        this.value = value
        this.binding_stack = []
        this.meta = meta
    }

    deref() {
        return this.value
    }

    invoke(args) {
        return this.value(...args)
    }

    set_value(value) {
        this.value = value
    }

    push_binding(value) {
        this.binding_stack.unshift(this.value)
        this.value = value
    }

    pop_binding() {
        this.value = this.binding_stack.shift()
    }
}
