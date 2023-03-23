// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import Sym from "./Sym.mjs"
import Var from "./Var.mjs"

//const global = (o,eval)("this")
const global =
      typeof global !== 'undefined' ? global :
      typeof self !== 'undefined' ? self :
      typeof window !== 'undefined' ? window : {};

const USER = new Module("user")
const BUNNY_LANG = new Module("bunny.lang")

const VAR_GLOBAL_SCOPE = BUNNY_LANG.intern("global-scope", null)
const VAR_CURRENT_MODULE = BUNNY_LANG.intern("*current-module*", USER)

const VAR_LIST_CTOR = BUNNY_LANG.intern("list-ctor", null)
const VAR_MAP_CTOR = BUNNY_LANG.intern("map-ctor", null)
const VAR_SET_CTOR = BUNNY_LANG.intern("set-ctor", null)
const VAR_VECTOR_CTOR = BUNNY_LANG.intern("vector-ctor", null)

function list(...args) {return VAR_LIST_CTOR.invoke(...args)}
function hash_map(...kvs) {return VAR_MAP_CTOR.invoke(...kvs)}
function set(...args) {return VAR_SET_CTOR.invoke(...args)}
function vector(...args) {return VAR_VECTOR_CTOR.invoke(...args)}

BUNNY_LANG.intern("list", list)
BUNNY_LANG.intern("hash-map", hash_map)
BUNNY_LANG.intern("set", set)
BUNNY_LANG.intern("vector", vector)

BUNNY_LANG.intern("symbol", function(ns, name) {return new Sym(ns, name)})

class Runtime {
    constructor() {
        this.modules = {user: USER, 'bunny.lang': BUNNY_LANG}
    }

    static instance() {
        if (!global.__BUNNY__) {
            throw("Bunny runtime not initialized")
        }
        return global.__BUNNY__
    }

    static init() {
        global.__BUNNY__ = new Runtime()
        global.__BUNNY_MODS__ = global.__BUNNY__.modules
    }

    module(name) {
        this.modules[Module.munge(name)]
    }

    resolve(sym) {
        this.module(sym.namespace).resolve(sym.name)
    }
}

function resolve(sym) {Runtime.instance().resolve(sym)}
function module(sym) {Runtime.instance().module(sym)}

BUNNY_LANG.intern("the-module", module)
BUNNY_LANG.intern("resolve", resolve)
BUNNY_LANG.intern("conj", function(coll, o) {return resolve(new Sym("bunny.lang", "-conj")).invoke(coll,o)})

const prelude = ''

export default Runtime
export {resolve}
