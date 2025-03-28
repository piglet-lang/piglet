// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Lookup from "./protocols/Lookup.mjs"
import {fixed_prop} from "./util.mjs"
import {assert} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"

/**
 * Base class for Sym, QSym, Keyword, QName, PrefixName.
 *
 * Contains some dark magic to ensure these are callable as if they are
 * functions (which in JS land means they have to _be_ functions), hence the
 * constructor which returns a function which delegates to the Lookup protocol.
 * We then redefine the prototype so that they also behave as instances of their
 * respective classes as defined. The magic is further darkened by the fact that
 * we want the function name to match the identifier name.
 */
export default class AbstractIdentifier {
    constructor(meta, sigil, name, id_str) {
        assert(id_str)
        const self = name ? ({[name](coll, fallback) {
            if (Lookup.satisfied(coll)) {
                if (fallback === undefined) {
                    return Lookup._get(coll, self)
                }
                return Lookup._get(coll, self, fallback)
            }
            fallback = fallback === undefined ? null : fallback
            if (coll != null) {
                const n = self.fqn || self.name
                return n in coll ? coll[n] : fallback
            }
            return fallback
        }}[name]) : (function (coll, fallback) {
            if (Lookup.satisfied(coll)) {
                if (fallback === undefined) {
                    return Lookup._get(coll, self)
                }
                return Lookup._get(coll, self, fallback)
            }
            fallback = fallback === undefined ? null : fallback
            if (coll != null) {
                const n = self.fqn || self.name
                return n in coll ? coll[n] : fallback
            }
            return fallback
        })

        Object.setPrototypeOf(self, this.constructor.prototype)
        fixed_prop(self, "_sigil", sigil)
        fixed_prop(self, "_id_str", id_str)
        set_meta(self, meta)
        return self
    }

    identifier_str() {
        return this._id_str
    }

    toString() {
        return `${this._sigil}${this._id_str}`
    }

    inspect() {
        return `${this.constructor.name}(${this.toString()})`
    }

    [Symbol.for('nodejs.util.inspect.custom')](depth, options, inspect) {
        return `${options.stylize(this.constructor.name, 'special')}(${options.stylize(this.toString(), 'symbol')})`
    }
}

Object.setPrototypeOf(AbstractIdentifier.prototype, Function)
