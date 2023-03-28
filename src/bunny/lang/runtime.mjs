// Copyright (c) Arne Brasseur 2023. All rights reserved.

import List from "./List.mjs"
import Sym from "./Sym.mjs"
import Var from "./Var.mjs"
import Module from "./Module.mjs"

let USER = new Module("user")
let BUNNY_LANG = new Module("bunny.lang")

let GLOBAL_SCOPE = BUNNY_LANG.intern("global-scope", null)
let CURRENT_MODULE = BUNNY_LANG.intern("*current-module*", USER)

let RUNTIME = {}
RUNTIME.modules = {}
RUNTIME.modules['user'] = USER
RUNTIME.modules['bunny$$lang'] = BUNNY_LANG

function init_runtime(global, global_identifier) {
    global.$bunny = RUNTIME
    global.$bunny$ = RUNTIME.modules
    GLOBAL_SCOPE.set_value(global_identifier)
}

function get_module(mod) {
    const munged_name = Module.munge((typeof mod == "string") ? mod : mod.name)
    return RUNTIME.modules[munged_name]
}

function init_module(module_form) {
    const mod = Module.from(module_form)
    RUNTIME.modules[Module.munge(mod.name)] ||= mod
    return get_module(mod.name)
}

function find_var(ns, name) {
    return get_module(ns).resolve(name)
}

function resolve(sym) {
    find_var(sym.namespace, sym.name)
}

BUNNY_LANG.intern("list-ctor", function() {return new List(Array.from(arguments))})
BUNNY_LANG.intern("list", function() {return new List(Array.from(arguments))})
BUNNY_LANG.intern("symbol", function(ns, name) {return new Sym(ns, name)})
BUNNY_LANG.intern("resolve", resolve)
BUNNY_LANG.intern("get-module", get_module)
BUNNY_LANG.intern("conj", function(coll, o) {return BUNNY_LANG.resolve("-conj").invoke([coll,o])})
RUNTIME.var = find_var

USER.refer_module(BUNNY_LANG)

export {GLOBAL_SCOPE, CURRENT_MODULE, RUNTIME, init_runtime, init_module, find_var, resolve, get_module}
