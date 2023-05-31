// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {PIGLET_PKG, assert, munge, fixed_props, fixed_prop} from "./util.mjs"
import Module from "./Module.mjs"
import {dict} from "./Dict.mjs"

export default class Package {
    constructor(name) {
        fixed_props(
            this,
            {name: name,
             modules: {},
             aliases: {},
             index: {}})
        fixed_prop(this.aliases, 'piglet', PIGLET_PKG)
    }

    find_module(mod) {
        if (typeof mod === 'string') {
            const munged_mod = munge(mod)
            if (munged_mod in this.modules) {
                return this.modules[munged_mod]
            }
            return null
        }
        throw `Unexpected type ${mod?.constructor || typeof mod}`
    }

    ensure_module(mod) {
        if (mod.startsWith("http")) throw new Error("Bad module name")
        const munged = munge(mod)
        if (!(munged in this.modules)) {
            const module = new Module(dict("package", this, "pkg", this.name, "name", mod))
            this.modules[munged] = module
            this.index[munged] = module.vars
        }
        return this.modules[munged]
    }

    add_alias(from, to) {
        assert(!(from in this.aliases))
        this.aliases[from] = to
    }

    resolve_alias(alias) {
        const resolved = this.aliases[alias]
        assert(resolved, `Alias ${alias} not found in ${this.name} ${this.aliases}`)
        return resolved
    }
}
