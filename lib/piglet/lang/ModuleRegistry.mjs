// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import Package from "./Package.mjs"
import PrefixName from "./PrefixName.mjs"
import {assert, assert_type} from "./util.mjs"
import {dict} from "./Dict.mjs"

export default class ModuleRegistry {
    constructor() {
        this.packages = {}
        const piglet_lang = this.ensure_module("piglet", "lang")
        this.current_module = piglet_lang.ensure_var("*current-module*")
    }

    ensure_package(name) {
        return this.packages[Module.munge(name)] ||= new Package(name)
    }

    find_module(pkg, mod) {
        [pkg, mod] = this.split_mod_name(pkg, mod)
        const munged_pkg = Module.munge(pkg)
        const munged_mod = Module.munge(mod)
        return this.packages[munged_pkg]?.modules[munged_mod]
    }

    ensure_module(pkg, mod) {
        [pkg, mod] = this.split_mod_name(pkg, mod)
        const module = this.ensure_package(pkg).modules[Module.munge(mod)] ||= new Module(dict("pkg", pkg, "name", mod))
        if (!(pkg == "piglet" && mod == "lang")) {
            Object.setPrototypeOf(module.vars, this.find_module("piglet", "lang").vars)
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
