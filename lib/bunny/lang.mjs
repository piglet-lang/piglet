// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./lang/Sym.mjs"
import Keyword from "./lang/Keyword.mjs"
import {QName, PrefixName, Context} from "./lang/QName.mjs"

import List from "./lang/List.mjs"
import Cons from "./lang/Cons.mjs"
import SeqIterator from "./lang/SeqIterator.mjs"
import IteratorSeq from "./lang/IteratorSeq.mjs"

import Var from "./lang/Var.mjs"
import Module from "./lang/Module.mjs"
import ModuleRegistry from "./lang/ModuleRegistry.mjs"

import StringReader from "./lang/StringReader.mjs"
import {define_protocol, extend_protocol} from "./lang/Protocol.mjs"

export const module_registry = new ModuleRegistry()

const self = module_registry.ensure_module("bunny:lang")
export default self

const user = module_registry.ensure_module("user")
self.intern('*current-module*', user)

function not_implemented() {
    throw new Error("function not available, runtime isn't loaded")
}

self.intern("list-ctor", function() {return new List(Array.from(arguments))})

export function list() {return self.resolve("list-ctor").invoke(...arguments)}
self.intern("list", list)

export function symbol(ns, name) {return new Sym(ns, name)}
self.intern("symbol", symbol)

export function keyword(name) {return new Keyword(name)}
self.intern("keyword", keyword)

export function qname(name) {return new QName(name)}
self.intern("qname", qname)

export function prefix_name(prefix, suffix) {return new PrefixName(prefix, suffix)}
self.intern("prefix-name", prefix_name)

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

export function type(o) {
    if (o && typeof o === 'object')
        return o.constructor
}
self.intern("type", type)

export function find_module(mod) {
    return module_registry.find_module(mod)
}
self.intern("find-module", find_module)

export function ensure_module(name) {
    return module_registry.ensure_module(name)
}
self.intern("ensure-module", ensure_module)

export function resolve(sym) {
    const current_module = self.resolve("*current-module*").deref()
    if (sym.namespace) {
        const aliased = current_module.aliases[sym.namespace]
        if (aliased) {
            return find_module(aliased)?.resolve(sym.name)
        }
        return find_module(sym.namespace)?.resolve(sym.name)
    }
    return current_module.resolve(sym.name)
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
    if (null === o) {
        return null
    }
    if (seq_pred(o)) {
        return o
    }
    if (seqable_pred(o)) {
        return self.resolve("-seq").invoke(o)
    }
    if (iterator_pred(o)) {
        return IteratorSeq.of(o)
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
    if (o === null) return "nil"
    if (o === void(0)) return "undefined"

    if (typeof o === 'string') {
        return JSON.stringify(o)
    }

    if (typeof o === 'object') {
        if (Repr.satisfied(o)) return self.resolve("-repr").invoke(o)
        if (o.repr instanceof Function) return o.repr()

        if (o instanceof Var) {
            return "#'" + o.module + "/" + o.name
        }

        if (Array.isArray(o)) {
            let res = "[" + print_str(first(o))
            o = rest(o)
            while (o) {
                res += " " + print_str(first(o))
                o = rest(o)
            }
            return res + "]"
        }

        if (seq_pred(o)) {
            let res = "(" + print_str(first(o))
            o = rest(o)
            while (o) {
                res += " " + print_str(first(o))
                o = rest(o)
            }
            return res + ")"
        }
        if (o.toString && o.toString !== {}.toString) return o.toString()

        if (o?.constructor?.name) {
            return "#js/" + o.constructor.name + " {" +Object.keys(o).map(k=>":"+k+" "+print_str(o[k])).join(", ") + "}"
        }
        return "#js {" + Object.keys(o).map(k=>":"+k+" "+print_str(o[k])).join(", ") + "}"
    }
    return "" + o
}
self.intern("print-str", print_str)

export function println(...args) {
    console.log(...Array.from(args, (a)=>(typeof a === 'string') ? a : print_str(a)))
}
self.intern("println", println)

export function reduce(rf, ...args) {
    let coll, acc
    if (rest.length == 2) {
        acc = args[0]
        coll = args[1]
    } else {
        coll = args[0]
        acc = first(coll)
        coll = rest(coll)
    }
    while (seq(coll)) {
        acc = rf(acc, first(coll))
        coll = rest(coll)
    }
    return acc
}
self.intern("reduce", reduce)

export function map(f, ...colls) {
    const res = []
    let args = []
    while (colls.every(seq)) {
        args = colls.map(first)
        colls = colls.map(rest)
        res.push(f(...args))
    }
    return list(...res)
}
self.intern("map", map)

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

export function string_reader(s) {
    return new StringReader(s)
}
self.intern("string-reader", string_reader)

export function read_string(s) {
    return string_reader(s).read()
}
self.intern("read-string", read_string)

export function str(...args) {
    return args.map(print_str).join("")
}
self.intern("str", str)

////////////////////////////////////////////////////////////////////////////////

export const Eq = define_protocol(
    self, "Eq",
    [["=", [[["this", "that"], "Check equality"]]]])

extend_protocol(Eq, "number", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "string", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "undefined", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "boolean", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "null", [["=", 2, function(self, other) {return self === other}]])

export const HasMeta = define_protocol(
    self, "HasMeta",
    [["-meta", [[["this"], "Retrieve the metadata for this object"]]]])

export const Conjable = define_protocol(
    self, "Conjable",
    [["-conj", [[["this", "e"], "Return a collection with the element added."]]],])

extend_protocol(Conjable, "null", [["-conj", 2, function(_, e) {return list(e)}]])

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

export const Repr = define_protocol(
    self, "Repr",
    [["-repr", [[["this"], "Return a string representation of the object"]]]])

extend_protocol(Repr, "number", [["-repr", 1, function(self) {return self.toString()}]])
extend_protocol(Repr, "string", [["-repr", 1, function(self) {return "\"" + self + "\""}]])
extend_protocol(Repr, "undefined", [["-repr", 1, function(self) {return "undefined"}]])
extend_protocol(Repr, "boolean", [["-repr", 1, function(self) {return self.toString()}]])
extend_protocol(Repr, "null", [["-repr", 1, function(self) {return "null"}]])
