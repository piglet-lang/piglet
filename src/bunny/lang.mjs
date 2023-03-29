// Copyright (c) Arne Brasseur 2023. All rights reserved.

import List from "./lang/List.mjs"
import Sym from "./lang/Sym.mjs"
import Var from "./lang/Var.mjs"
import Module from "./lang/Module.mjs"
import {define_protocol, extend_protocol} from "./lang/Protocol.mjs"

const self = new Module('bunny.lang')
export const module_registry = {bunny$$lang: self}

function not_implemented() {
    throw new Error("function not available, runtime isn't loaded")
}

export function list() {return self.resolve("list-ctor")(...arguments)}
export function symbol(ns, name) {return new Sym(ns, name)}

export function find_module(mod) {
    const munged_name = Module.munge((typeof mod == "string") ? mod : mod.name)
    return module_registry[munged_name]
}

export function ensure_module(module_form) {
    let mod = Module.from(module_form)
    module_registry[Module.munge(mod.name)] ||= mod
    return find_module(mod.name).refer_module(self)
}

export function resolve(sym) {
    return find_module(sym.namespace)?.resolve(sym.name)
}

export function conj(coll, o) {
    return self.resolve("-conj").invoke([coll,o])
}

////////////////////////////////////////////////////////////////////////////////

export const Eq = define_protocol(
    self, "Eq",
    [["=", [[["this", "that"], "Check equality"]]]])

export const HasMeta = define_protocol(
    self, "HasMeta",
    [["-meta", [[["this"], "Retrieve the metadata for this object"]]]])

export const Conjable = define_protocol(
    self, "Conjable",
    [["-conj", [[["this", "e"], "Return a collection with the element added."]]],])

export const Associative = define_protocol(
    self, "Associative",
    [["-assoc", [[["this", "k", "v"], "Associate the given value with the given key"]]],
     ["-dissoc", [[["this", "k", "v"], "Remove the association between the thegiven key and value"]]],])

export const Seqable = define_protocol(
    self, "Seqable",
    [["-seq", [[["this"], "Return a seq over the collection"]]]])

export const Seq = define_protocol(
    self, "Seq",
    [["-first", [[["this"], "Return the first element of the seq"]]],
     ["-rest", [[["this"], "Return a seq of the remaining elements of this seq"]]]])

extend_protocol(
    Eq,
    List,
    [["=", 2,
      function(self, other) {
          const i1 = self[Symbol.iterator]()
          if (typeof other !== "object" || !(Symbol.iterator in other)) {
              return false
          }
          const i2 = other[Symbol.iterator]()
          var v1 = i1.next()
          var v2 = i2.next()
          while (Eq.methods["="](v1.value, v2.value) && !v1.done && !v2.done) {
              v1 = i1.next()
              v2 = i2.next()
          }
          return Eq.methods["="](v1.value, v2.value) && v1.done === v2.done
      }]])

extend_protocol(Eq, "number", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "string", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "undefined", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "boolean", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "null", [["=", 2, function(self, other) {return self === other}]])

extend_protocol(
    HasMeta,
    List,
    [["-meta", 1,
      function(self) {
          return self.meta}]])

extend_protocol(
    Conjable,
    List,
    [["-conj", 2,
      function(self, o) {
          const elements = Array.from(self)
          elements.unshift(o)
          return new List(elements)}]])

////////////////////////////////////////////////////////////////////////////////

self.intern('*current-module*', null)
self.intern("list-ctor", function() {return new List(Array.from(arguments))})
self.intern("list", list)
self.intern("symbol", symbol)
self.intern("resolve", resolve)
self.intern("find-module", find_module)
self.intern("ensure-module", ensure_module)
self.intern("conj", conj)

export default self
