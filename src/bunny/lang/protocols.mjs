// Copyright (c) Arne Brasseur 2023. All rights reserved.

import List from "./List.mjs"
import Sym from "./Sym.mjs"
import Protocol, {define_protocol, extend_protocol, munge_method_name} from "./Protocol.mjs"

let Eq = define_protocol(
    new Sym("bunny.lang", "Eq"),
    [["=", [[["this", "that"], "Check equality"]]]])

let HasMeta = define_protocol(
    new Sym("bunny.lang", "HasMeta"),
    [["-meta", [[["this"], "Retrieve the metadata for this object"]]]])

let Conjable = define_protocol(
    new Sym("bunny.lang", "Conjable"),
    [["-conj", [[["this", "e"], "Return a collection with the element added."]]],])

let Associative = define_protocol(
    new Sym("bunny.lang", "Associative"),
    [["-assoc", [[["this", "k", "v"], "Associate the given value with the given key"]]],
     ["-dissoc", [[["this", "k", "v"], "Remove the association between the thegiven key and value"]]],])

let Seqable = define_protocol(
    new Sym("bunny.lang", "Seqable"),
    [["-seq", [[["this"], "Return a seq over the collection"]]]])

let Seq = define_protocol(
    new Sym("bunny.lang", "Seq"),
    [["-first", [[["this"], "Return the first element of the seq"]]],
     ["-rest", [[["this"], "Return a seq of the remaining elements of this seq"]]]])

extend_protocol(
    Eq,
    List,
    [["=", 2,
      function(self, other) {
          let i1 = self[Symbol.iterator]()
          if (typeof other !== "object" || !(Symbol.iterator in other)) {
              return false
          }
          let i2 = other[Symbol.iterator]()
          var v1 = i1.next()
          var v2 = i2.next()
          while (Eq.methods["="](v1.value, v2.value) && !v1.done && !v2.done) {
              console.log()
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
          let elements = Array.from(self)
          elements.unshift(o)
          return new List(elements)}]])

export {Eq, HasMeta, Conjable, Associative, Seqable, Seq}
