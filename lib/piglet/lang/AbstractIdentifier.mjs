// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Lookup from "./protocols/Lookup.mjs"
import {fixed_props} from "./util.mjs"
import {assert} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"

export default class AbstractIdentifier {
    constructor(meta, sigil, name, id_str) {
        assert(id_str)
        const self = name ? ({[name](coll, fallback) {
            if (fallback === undefined) {
                return Lookup._get(coll, self)
            }
            return Lookup._get(coll, self, fallback)
        }}[name]) : (function (coll, fallback) {
            if (fallback === undefined) {
                return Lookup._get(coll, self)
            }
            return Lookup._get(coll, self, fallback)
        })

        Object.setPrototypeOf(self, this.constructor.prototype)
        fixed_props(self, {_sigil: sigil, _id_str: id_str})
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
}

Object.setPrototypeOf(AbstractIdentifier.prototype, Function)
