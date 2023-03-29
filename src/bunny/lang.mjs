// Copyright (c) Arne Brasseur 2023. All rights reserved.

import List from "./lang/List.mjs"
import Sym from "./lang/Sym.mjs"
import Var from "./lang/Var.mjs"
import Module from "./lang/Module.mjs"
import Cons from "./lang/Cons.mjs"
import SeqIterator from "./lang/SeqIterator.mjs"
import IteratorSeq from "./lang/IteratorSeq.mjs"
import {define_protocol, extend_protocol} from "./lang/Protocol.mjs"

const self = new Module('bunny.lang')
const user = new Module('user')
export default self

export const module_registry = {bunny$$lang: self, user: user}
self.intern('*current-module*', user)

function not_implemented() {
    throw new Error("function not available, runtime isn't loaded")
}

self.intern("list-ctor", function() {return new List(Array.from(arguments))})

export function list() {return self.resolve("list-ctor").invoke(...arguments)}
self.intern("list", list)

export function symbol(ns, name) {return new Sym(ns, name)}
self.intern("symbol", symbol)

export function name(sym) {
    if (typeof sym === 'string') {
        return sym
    }
    return sym.name
}
self.intern("name", name)

export function namespace(sym) {
    return sym.namespace
}
self.intern("namespace", namespace)

export function find_module(mod) {
    const munged_name = Module.munge((typeof mod == "string") ? mod : mod.name)
    return module_registry[self.resolve("*current-module*").deref()?.aliases[munged_name] || munged_name]
}
self.intern("find-module", find_module)

export function ensure_module(name) {
    module_registry[munge(name)] ||= new Module(name).refer_module(self)
    return find_module(name)
}
self.intern("ensure-module", ensure_module)

export function resolve(sym) {
    const mod = sym.namespace ? find_module(sym.namespace) : self.resolve("*current-module*").deref()
    return mod?.resolve(sym.name)
}
self.intern("resolve", resolve)

export function intern(sym, val, meta) {
    return ensure_module(sym.namespace).intern(sym.name, value, meta)
}
self.intern("intern", intern)

export function conj(coll, o, ...rest) {
    if (rest.length > 0) {
        return Array.from(rest).reduce((acc,e)=>conj(acc,e), self.resolve("-conj").invoke(coll,o))
    }
    return self.resolve("-conj").invoke(coll,o)
}
self.intern("conj", conj)

export function cons(val, seq) {
    return new Cons(val, seq)
}
self.intern("cons", cons)

export function satisfies_pred(protocol, obj) {
    return protocol.satisfied(obj)
}
self.intern("satisfies?", satisfies_pred)

export function munge(str) {
    return Module.munge(str)
}
self.intern("munge", munge)

export function unmunge(str) {
    return Module.unmunge(str)
}
self.intern("unmunge", unmunge)

export function fn_pred(o) {
    return typeof o === 'function'
}
self.intern("fn?", fn_pred)

export function array_pred(o) {
    return Array.isArray(o)
}
self.intern("array?", array_pred)

export function iterator_pred(o) {
    return fn_pred(o.next)
}
self.intern("iterator?", iterator_pred)

export function iterable_pred(o) {
    return !!o[Symbol.iterator]
}
self.intern("iterable?", iterable_pred)

export function iterator(o) {
    if (iterator_pred(o)) {
        return o
    }
    if (iterable_pred(o)) {
        return o[Symbol.iterator]()
    }
    if (seq_pred(o)) {
        return new SeqIterator(o)
    }
    if (seqable_pred(o)) {
        return new SeqIterator(seq(o))
    }
}
self.intern("iterator", iterator)

export function seq_pred(o) {
    return Seq.satisfied(o)
}
self.intern("seq?", seq_pred)

export function seqable_pred(o) {
    return Seqable.satisfied(o)
}
self.intern("seqable?", seqable_pred)

export function seq(o) {
    if (seq_pred(o)) {
        return o
    }
    if (seqable_pred(o)) {
        return self.resolve("-seq").invoke(o)
    }
    if (iterator_pred(o)) {
        return new IteratorSeq(o)
    }
    if (iterable_pred(o)) {
        return IteratorSeq.of(iterator(o))
    }
    throw new Error("" + o + " is not seqable")
}
self.intern("seq", seq)

export function first(o) {
    return self.resolve("-first").invoke(seq(o))
}
self.intern("first", first)

export function rest(o) {
    return self.resolve("-rest").invoke(seq(o))
}
self.intern("rest", rest)

export function print_str(o) {
    if (seq_pred(o)) {
        let res = "(" + print_str(first(o))
        o = rest(o)
        while (o) {
            res += " " + print_str(first(o))
            o = rest(o)
        }
        return res + ")"
    }
    return "" + o
}
self.intern("print-str", print_str)

export function println(o) {
    console.log(print_str(o))
}
self.intern("println", println)

export function reduce(rf, ...rest) {
    const rf2 = (a,b)=>rf(a,b)
    if (rest.length == 2) {
        const [init, coll] = rest
        return Array.from(coll).reduce(rf2, init)
    }
    const [coll] = rest
    return Array.from(coll).reduce(rf2)
}
self.intern("reduce", reduce)

export function plus(...rest) {
    return reduce((a,b)=>a+b, rest)
}
self.intern("+", plus)

export function minus(...rest) {
    return reduce((a,b)=>a-b, rest)
}
self.intern("-", minus)

export function multiply(...rest) {
    return reduce((a,b)=>a*b, rest)
}
self.intern("*", multiply)

export function divide(...rest) {
    return reduce((a,b)=>a/b, rest)
}
self.intern("/", divide)

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

// Primitives
extend_protocol(Eq, "number", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "string", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "undefined", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "boolean", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "null", [["=", 2, function(self, other) {return self === other}]])

extend_protocol(Conjable, "null", [["-conj", 2, function(_, e) {return list(e)}]])

// List
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

// Cons

extend_protocol(
    Conjable,
    Cons,
    [["-conj", 2, function(self, o) {return new Cons(o, self)}]])

extend_protocol(
    Seq,
    Cons,
    [["-first", 1, function(self) {return self.x}],
     ["-rest", 1, function(self) {return self.xs}]])

extend_protocol(
    Seq,
    IteratorSeq,
    [["-first", 1, function(self) {return self.first()}],
     ["-rest", 1, function(self) {return self.rest()}]])

user.refer_module(self)
