// Copyright (c) Arne Brasseur 2023. All rights reserved.

import List from "./List.mjs"
import Var from "./Var.mjs"
import Module from "./Module.mjs"

let MODULE_USER = new Module("user")
let MODULE_BUNNY_LANG = new Module("bunny.lang")

let GLOBAL_SCOPE = new Var("bunny.lang", "global-scope", null)
let CURRENT_MODULE = new Var("bunny.lang", "*current-module*", MODULE_USER)
MODULE_BUNNY_LANG.vars["*current-module*"] = CURRENT_MODULE
MODULE_BUNNY_LANG.vars["global-scope"] = GLOBAL_SCOPE
MODULE_BUNNY_LANG.vars["list"] = new Var("bunny.lang", "list", function() {return new List(Array.from(arguments))})

let RUNTIME = {}
RUNTIME.modules = {}
RUNTIME.modules['user'] = MODULE_USER
RUNTIME.modules['bunny.lang'] = MODULE_BUNNY_LANG

function init_runtime(global, global_identifier) {
    global.bunny = RUNTIME
    GLOBAL_SCOPE.set_value(global_identifier)
}

export {GLOBAL_SCOPE, CURRENT_MODULE, RUNTIME, init_runtime}
