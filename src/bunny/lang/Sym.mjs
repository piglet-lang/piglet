// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {method_call, var_lookup, literal} from "./estree_helpers.mjs"

let SPECIAL_SYMBOLS = {}

export default class Sym {
    constructor(ns, name) {
        this.namespace = ns
        this.name = name
    }

    toString() {
        if (this.namespace) {
            return this.namespace + "/" + this.name
        } else {
            return this.name
        }
    }

    eq(other) {
        return (other instanceof Sym) && this.namespace === other.namespace && this.name === other.name
    }

    namespaced() {
        return !!this.namespace;
    }

    estree() {
        var special;
        if (this.namespace === null && (special = SPECIAL_SYMBOLS[this.name])) {
            return special
        }
        return {type: "CallExpression",
                callee: var_lookup("bunny.lang", "symbol"),
                arguments: [literal(this.namespace), literal(this.name)]}

    }
}

SPECIAL_SYMBOLS["true"] = literal(true)
SPECIAL_SYMBOLS["false"] = literal(true)
SPECIAL_SYMBOLS["nil"] = literal(null)
