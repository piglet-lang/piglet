// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import Package from "./Package.mjs"
import PrefixName from "./PrefixName.mjs"
import Sym from "./Sym.mjs"
import QSym from "./QSym.mjs"
import {PIGLET_PKG, assert, assert_type, munge, fixed_prop, fixed_props} from "./util.mjs"
import {dict} from "./Dict.mjs"
import QName from "./QName.mjs"

function qname(s) { return QName.parse(s) }

const pkg$name = qname('https://vocab.piglet-lang.org/package/name')
const pkg$deps = qname('https://vocab.piglet-lang.org/package/deps')
const pkg$location = qname('https://vocab.piglet-lang.org/package/location')
const pkg$paths = qname('https://vocab.piglet-lang.org/package/paths')

export default class ModuleRegistry {
  constructor() {
    fixed_prop(this, "packages", new Object(null))
    fixed_prop(this, "index", new Object(null))
    fixed_prop(this, "listeners", [])
    const piglet_lang = this.ensure_module(PIGLET_PKG, "lang")
    this.current_module = piglet_lang.ensure_var("*current-module*")
  }

  static instance() {
    return this._instance ||= new this()
  }

  find_package(name) {
    assert(name.includes('://') && new URL(name).pathname.indexOf(":") === -1,
           `Package name must be single segment URI, got ${name}`)
    return this.packages[name]
  }

  ensure_package(name) {
    assert(name.includes('://') && new URL(name).pathname.indexOf(":") === -1,
           `Package name must be single segment URI, got ${name}`)
    if (!(name in this.packages)) {
      const pkg = new Package(name)
      this.packages[name] = pkg
      fixed_prop(this.index,
                 name,
                 // name === PIGLET_PKG ? 'piglet' : name,
                 pkg.index)
      for (const {on_new_package} of this.listeners) {
        on_new_package && on_new_package(pkg)
      }
    }
    return this.packages[name]
  }

  package_from_spec(pkg_spec) {
    const pkg_name = pkg_spec.get(pkg$name)
    const pkg = this.ensure_package(pkg_name.toString())
    pkg.paths = pkg_spec.get(pkg$paths) || []
    pkg.deps = pkg_spec.get(pkg$deps) || dict()
    pkg.location = pkg_spec.get(pkg$location).toString()
    return pkg
  }

  find_module(pkg, mod) {
    [pkg, mod] = this.split_mod_name(pkg, mod)
    return this.packages[pkg]?.find_module(mod)
  }

  ensure_module(pkg, mod) {
    [pkg, mod] = this.split_mod_name(pkg, mod)
    const module = this.ensure_package(pkg).ensure_module(mod)
    if (!(pkg == PIGLET_PKG && mod == "lang")) {
      Object.setPrototypeOf(module.vars, this.find_module(PIGLET_PKG, "lang").vars)
    }
    return module
  }

  resolve_module(current_package_name, from) {
    // console.log("resolve_module", {current_package_name, from})
    const current_package = this.ensure_package(current_package_name)
    if (typeof from === 'string') {
      return this.ensure_module(current_package_name, `js-interop/${from.replace(':', '__').replaceAll('../','')}`)
    } else if (from instanceof Sym) {
      if (from.mod) {
        const alias_pkg = current_package.aliases[from.mod]
        if (!alias_pkg) {
          throw new Error(`Alias ${from.mod} not found in ${current_package.name}: ${JSON.stringify(current_package.aliases)}`)
        }
        return this.ensure_module(current_package.aliases[from.mod], from.name)
      } else {
        return this.ensure_module(current_package_name, from.name)
      }
    } else if (from instanceof QSym) {
      return this.ensure_module(from)
    } else {
      throw new Error(`Bad type for :from ${from} ${from?.constructor?.name || typeof from}`)
    }
  }

  register_module({pkg, name, imports, context, location, self_ref}) {
    // console.log("register_module", {pkg, name, imports, context, location, self_ref})
    const mod = this.ensure_module(pkg, name)
    while(mod.imports.shift()) {}
    Object.keys(mod.aliases).forEach((k)=>delete mod.aliases[k])
    for (const {alias, from} of imports) {
      const import_mod = this.resolve_module(pkg, from)
      mod.imports.push({alias: alias, from: import_mod})
      mod.aliases[alias] = import_mod
    }
    mod.location = location
    mod.context = context
    mod.self_ref = self_ref
    return mod
  }

  /**
   * Takes the current Package and a `(module ...)` form, and returns a Module
   * object. The module is added to the registry as part of the
   * current_package, and any imports aliases are added (but not loaded!).
   */
  parse_module_form(current_package, module_form) {
    const mod_opts = Module.parse_opts(current_package.name, module_form)
    const module = this.ensure_module(current_package.name, mod_opts.get('name'))
    module.merge_opts(mod_opts.assoc('imports', mod_opts.get('imports').map(({alias, from})=>{
      if (typeof from === 'string') {
        return {js_module: true,
                module_path: from,
                alias: alias,
                from: this.resolve_module(current_package.name, from)}
      }
      return {alias: alias, from: this.resolve_module(current_package.name, from)}
    })))
    return module
  }

  /**
   * Helper method to extract the package+mod names, either from a given
   * PrefixName (1-arg), from a single String arg (gets split by colon
   * separator), or from explicitly given String args for pkg and mod (2-args)
   */
  split_mod_name(pkg, mod) {
    const opkg = pkg, omod = mod
    if (!mod) {
      if (typeof pkg === 'string' && pkg.includes('://')) {
        pkg = QSym.parse(pkg)
      }
      if (pkg instanceof PrefixName) {
        throw "PrefixName used where package name (Sym or QSym) was expected"
      } else if (pkg instanceof Sym) {
        // When identifying a package with a symbol the two components
        // (pkg/mod) are assigned to the mod/var fields. This is an
        // implementation detail that really only occurs in module forms.
        mod = pkg.name
        pkg = pkg.mod
      } else if (pkg instanceof QSym) {
        mod = pkg.mod
        pkg = pkg.pkg
      } else if (pkg instanceof String) {
        const parts = pkg.split(":")
        switch (parts.length) {
        case 1:
          mod = parts[0]
          pkg = this.current_module.deref().pkg
          break
        case 2:
          pkg = parts[0] || this.current_module.deref().pkg
          mod = parts[1]
          break
        }
      }

    }
    assert(typeof pkg === 'string', `split_mod_name(${opkg}, ${omod}) expected pkg string => ${pkg} was ${typeof pkg}`)
    assert(typeof mod === 'string', `split_mod_name(${opkg}, ${omod}) expected mod string => ${mod} was ${typeof mod}`)
    return [pkg, mod]
  }

  inspect() {
    let s = "\nModuleRegistry(\n"
    for (const [pkg_name, pkg] of Object.entries(this.packages)) {
      for (const [mod_name, mod] of Object.entries(pkg.modules)) {
        s += `${pkg_name}:${mod_name}=${mod.inspect()},\n`
      }
    }
    s+=")"
    return s
  }
}
