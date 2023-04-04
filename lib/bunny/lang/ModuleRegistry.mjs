// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"

export default class ModuleRegistry {
    constructor() {
        this.modules = {}
        const bunny_lang = this.ensure_module("bunny:lang")
        this.current_module = bunny_lang.ensure_var("*current-module*")
    }

    find_module(mod) {
        const munged_name = Module.munge((typeof mod == "string") ? mod : mod.name)
        return this.modules[this.current_module.deref()?.aliases[munged_name] || munged_name]
    }

    ensure_module(name) {
        const module = this.modules[Module.munge(name)] ||= new Module(name)
        if (name !== "bunny:lang") {
            Object.setPrototypeOf(module.vars, this.find_module("bunny:lang").vars)
        }
        return module
    }
}
