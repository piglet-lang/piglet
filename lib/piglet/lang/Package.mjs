// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {PIGLET_PKG, munge, fixed_props, fixed_prop} from "./util.mjs"
import Module from "./Module.mjs"
import {dict} from "./Dict.mjs"

export default class Package {
    constructor(name) {
        fixed_props(
            this,
            {name: name,
             modules: {},
             aliases: {}})
        fixed_prop(this.aliases, 'piglet', PIGLET_PKG)
    }

    find_module(mod) {
        const munged_mod = munge(mod)
        return this.modules[munged_mod]
    }

    ensure_module(mod) {
        return this.modules[munge(mod)] ||= new Module(dict("package", this, "pkg", this.name, "name", mod))
    }

}
