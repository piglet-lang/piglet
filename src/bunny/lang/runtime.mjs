// Copyright (c) Arne Brasseur 2023. All rights reserved.

import List from "./List.mjs"
import Var from "./Var.mjs"
import Module from "./Module.mjs"

let USER = new Module("user")
let BUNNY_LANG = new Module("bunny.lang")

let GLOBAL_SCOPE = BUNNY_LANG.intern("global-scope", null)
let CURRENT_MODULE = BUNNY_LANG.intern("*current-module*", USER)

let RUNTIME = {}
RUNTIME.modules = {}
RUNTIME.modules['user'] = USER
RUNTIME.modules['bunny.lang'] = BUNNY_LANG

function init_runtime(global, global_identifier) {
    global.bunny = RUNTIME
    GLOBAL_SCOPE.set_value(global_identifier)
}

function get_module(mod) {
    return RUNTIME.modules[(typeof mod == "string") ? mod : mod.name]
}

function resolve(sym) {
    return RUNTIME.modules[sym.namespace].get_var(sym.name)
}

BUNNY_LANG.intern("list", function() {return new List(Array.from(arguments))})
BUNNY_LANG.intern("resolve", resolve)
BUNNY_LANG.intern("get-module", get_module)

export {GLOBAL_SCOPE, CURRENT_MODULE, RUNTIME, init_runtime, resolve, get_module}
