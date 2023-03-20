// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class Var {
    constructor(module, name, value, meta) {
        this.module = module
        this.name = name
        this.binding_stack = [value]
        this.meta = meta
    }

    deref() {
        return this.binding_stack[0]
    }

    invoke(args) {
        return this.deref().apply(null, args)
    }

    set_value(value) {
        this.binding_stack[0] = value
    }

    push_binding(value) {
        this.binding_stack.unshift(value)
    }

    pop_binding(value) {
        this.binding_stack.shift(value)
    }
}
