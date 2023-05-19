// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import Package from "./Package.mjs"
import PrefixName from "./PrefixName.mjs"
import {PIGLET_PKG, assert, assert_type, munge} from "./util.mjs"
import {dict} from "./Dict.mjs"
import QName from "./QName.mjs"

function qname(s) { return QName.parse(s) }

const pkg$name = qname('https://vocab.piglet-lang.org/package/name')
const pkg$deps = qname('https://vocab.piglet-lang.org/package/deps')
const pkg$location = qname('https://vocab.piglet-lang.org/package/location')
const pkg$paths = qname('https://vocab.piglet-lang.org/package/paths')

export default class ModuleRegistry {
    constructor() {
        this.packages = {}
        const piglet_lang = this.ensure_module(PIGLET_PKG, "lang")
        this.current_module = piglet_lang.ensure_var("*current-module*")
    }

    find_package(name) {
        assert(name.includes('://') && name.split(':').length === 2, `Package name must be URI, got ${name}`)
        return this.packages[name]
    }

    ensure_package(name) {
        assert(name.includes('://') && name.split(':').length === 2, `Package name must be URI, got ${name}`)
        return this.packages[name] ||= new Package(name)
    }

    package_from_spec(pkg_spec) {
        const pkg_name = pkg_spec.get(pkg$name)
        const pkg = this.ensure_package(pkg_name.toString())
        pkg.paths = pkg_spec.get(pkg$paths) || []
        pkg.deps = pkg_spec.get(pkg$deps) || dict()
        pkg.location = pkg_spec.get(pkg$location)
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

    /**
     * Helper method to extract the package+mod names, either from a given
     * PrefixName (1-arg), from a single String arg (gets split by colon
     * separator), or from explicitly given String args for pkg and mod (2-args)
     */
    split_mod_name(pkg, mod) {
        if (!mod) {
            if (pkg instanceof PrefixName) {
                mod = pkg.suffix
                pkg = pkg.prefix || this.current_module.deref().pkg
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
        assert_type(pkg, 'string')
        assert_type(mod, 'string')
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
