// Copyright (c) Arne Brasseur 2023. All rights reserved.

import List from "./lang/List.mjs"
import Sym from "./lang/Sym.mjs"
import Var from "./lang/Var.mjs"
import Module from "./lang/Module.mjs"
import Cons from "./lang/Cons.mjs"
import {define_protocol, extend_protocol} from "./lang/Protocol.mjs"

const self = new Module('bunny.lang')
export default self

export const module_registry = {bunny$$lang: self}
self.intern('*current-module*', null)

function not_implemented() {
    throw new Error("function not available, runtime isn't loaded")
}

self.intern("list-ctor", function() {return new List(Array.from(arguments))})

export function list() {return self.resolve("list-ctor")(...arguments)}
self.intern("list", list)

export function symbol(ns, name) {return new Sym(ns, name)}
self.intern("symbol", symbol)

export function find_module(mod) {
    const munged_name = Module.munge((typeof mod == "string") ? mod : mod.name)
    return module_registry[munged_name]
}
self.intern("find-module", find_module)

export function ensure_module(module_form) {
    let mod = Module.from(module_form)
    module_registry[Module.munge(mod.name)] ||= mod
    return find_module(mod.name).refer_module(self)
}
self.intern("ensure-module", ensure_module)

export function resolve(sym) {
    return find_module(sym.namespace)?.resolve(sym.name)
}
self.intern("resolve", resolve)

export function conj(coll, o) {
    return self.resolve("-conj").invoke(coll,o)
}
self.intern("conj", conj)

export function cons(val, seq) {
    return new Cons(val, seq)
}
self.intern("cons", cons)

export function munge(str) {
    return Module.munge(str)
}
self.intern("munge", munge)

export function seq(o) {
    if (Seq.satisfied(o)) {
        return o
    }
    console.log(o, (Seq.satisfied(o)))
}
self.intern("seq", seq)

export function first(o) {
    console.log(self.resolve("-first"))
    return self.resolve("-first").invoke(seq(o))
}
self.intern("first", first)

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

extend_protocol(
    Conjable,
    Cons,
    [["-conj", 2,
      function(self, o) {
          return new Cons(o, self)}]])

extend_protocol(
    Seq,
    Cons,
    [["-first", 1,
      function(self) {
          return self.x
      }],
     ["-rest", 1,
      function(self) {
          return self.xs
      }]])
