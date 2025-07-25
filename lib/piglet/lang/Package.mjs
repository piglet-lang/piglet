// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {PIGLET_PKG, assert, munge, fixed_props, fixed_prop} from "./util.mjs"
import Module from "./Module.mjs"
import {dict} from "./Dict.mjs"

export default class Package {
  constructor(name) {
    fixed_prop(this, "name", name)
    fixed_prop(this, "modules", new Object(null))
    fixed_prop(this, "aliases", new Object(null))
    fixed_prop(this, "index", new Object(null))
    fixed_prop(this, "listeners", [])
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
    const munged = munge(mod)
    if (!(munged in this.modules)) {
      const module = new Module(dict("package", this, "pkg", this.name, "name", mod))
      this.modules[munged] = module
      this.index[munged] = module.vars
      for (const {on_new_module} of this.listeners) {
        on_new_module && on_new_module(this, module)
      }
    }
    return this.modules[munged]
  }

  add_alias(from, to) {
    // console.log("add_alias", {self: this, from, to})
    assert(!(from in this.aliases), `Alias ${from} already exists: ${this.aliases[from]}`)
    this.aliases[from] = to
  }

  resolve_alias(alias) {
    const resolved = this.aliases[alias]
    assert(resolved, `Alias ${alias} not found in ${this.name} ${this.aliases}`)
    return resolved
  }

  inspect() {
    return `Package(${this.name})`
  }
}
