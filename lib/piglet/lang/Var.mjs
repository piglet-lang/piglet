// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {munge, valid_property_name_p, reserved_keyword_p} from "./util.mjs"
import {meta, set_meta_mutable} from "./metadata.mjs"
import Repr from "./protocols/Repr.mjs"
import QSym from "./QSym.mjs"

let var_counter = 0
function next_global_name() {
    let n = "", c = var_counter
    while (c > 25) {
        n += String.fromCharCode(97 + c%26)
        c = Math.floor(c/26)
    }
    n += String.fromCharCode(97 + c)
    var_counter+=1
    return n
}

const GLOBAL = typeof window === 'undefined' ? global : window

function js_name(n) {
    if (n.endsWith("?")) n = `${n.slice(0, -1)}_p`
    if (reserved_keyword_p(n)) n = `${n}$`
    if (!valid_property_name_p(n)) n = munge(n)
    return n
}

export default class Var {
    constructor(pkg, module, name, value, _meta) {
        const self = {[name](...args) {
            try {
                return self.value(...args)
            } catch (e) {
                if (typeof e === 'object') {
                    e.stack = `    at ${self.repr()} ${Repr._repr(meta(self))}\n${e.stack}`
                }
                throw e
            }
        }}[name]
        Object.setPrototypeOf(self, Var.prototype)
        self.fqn = new QSym(null, `${pkg}:${module}:${name}`)
        self.pkg = pkg
        self.module = module
        self.value = value
        self.binding_stack = []
        self.js_name = js_name(name)
        // self.global_name = next_global_name()
        // GLOBAL[self.global_name] = self
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
