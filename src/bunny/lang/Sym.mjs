// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {method_call, var_lookup, literal} from "./estree_helpers.mjs"

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

    isNamespaced() {
        return !!this.namespace;
    }

    estree() {
        return {type: "CallExpression",
                callee: var_lookup("bunny.lang", "symbol"),
                arguments: [literal(this.namespace), literal(this.name)]}

    }
}
