// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./lang/Sym.mjs"
import Keyword, {keyword} from "./lang/Keyword.mjs"
import {QName, PrefixName, Context} from "./lang/QName.mjs"

import List from "./lang/List.mjs"
import Cons from "./lang/Cons.mjs"
import Range from "./lang/Range.mjs"
import SeqIterator from "./lang/SeqIterator.mjs"
import IteratorSeq from "./lang/IteratorSeq.mjs"
import Dict, {dict} from "./lang/Dict.mjs"

import Var from "./lang/Var.mjs"
import Module from "./lang/Module.mjs"
import ModuleRegistry from "./lang/ModuleRegistry.mjs"

import StringReader from "./lang/StringReader.mjs"
import {define_protocol, extend_protocol} from "./lang/Protocol.mjs"
import {meta, reset_meta} from "./lang/metadata.mjs"

export const module_registry = new ModuleRegistry()

const self = module_registry.ensure_module("piglet", "lang")
export default self

const user = module_registry.ensure_module("localpkg", "user")
self.intern('*current-module*', user)

import MutableCollection from "./lang/protocols/MutableCollection.mjs"
import DictLike from "./lang/protocols/DictLike.mjs"

MutableCollection.intern(self)
DictLike.intern(self)

function not_implemented() {
    throw new Error("function not available, runtime isn't loaded")
}

self.intern("list-ctor", function(...args) {return new List(Array.from(args))})

export function list(...args) {return self.resolve("list-ctor").invoke(...args)}
self.intern("list", list)

export function range(...args) {return new Range(...args) }
self.intern("range", range)

export function symbol(pkg, mod, name) {
    if (arguments.length === 1) {
        return Sym.parse(pkg)
    }
    return new Sym(pkg, mod, name)
}
self.intern("symbol", symbol)

export function symbol_pred(s) {
    return s && s?.constructor === Sym
}
self.intern("symbol?", symbol_pred)

export function js_symbol_pred(s) {
    return typeof s === 'symbol'
}
self.intern("js-symbol?", symbol_pred)

export {keyword}
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

export function mod_name(sym) {
    return sym.mod
}
self.intern("mod-name", mod_name)

export function pkg_name(sym) {
    return sym.pkg
}
self.intern("pkg-name", pkg_name)

export function type(o) {
    if (o && typeof o === 'object')
        return o.constructor
}
self.intern("type", type)

export function find_module(pkg, mod) {
    return module_registry.find_module(pkg, mod)
}
self.intern("find-module", find_module)

export function ensure_module(pkg, mod) {
    return module_registry.ensure_module(pkg, mod)
}
self.intern("ensure-module", ensure_module)

export function resolve(sym) {
    let module = self.resolve("*current-module*").deref()
    if (sym.pkg) {
        module = find_module(sym.pkg, sym.mod)
    } else {
        if(sym.mod) {
            if(module.aliases[sym.mod]) {
                module = find_module(module.aliases[sym.mod])
            } else {
                module = find_module(module.pkg, sym.mod)
            }
        }
    }
    return module?.resolve(sym.name)
}
self.intern("resolve", resolve)

export function intern(sym, val, meta) {
    let mod = self.resolve("*current-module*").deref()
    return ensure_module(sym.pkg || mod.pkg, sym.mod || mod.mod).intern(sym.name, val, meta)
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

export {dict}
self.intern("dict", dict)

export function dict_pred(o) {
    return DictLike.satisfied(o)
}
self.intern("dict?", dict_pred)

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

    if (typeof o === 'symbol') {
        return `#js:Symbol \"${o.description}\"`
    }

    if (typeof o === 'object') {
        if (Repr.satisfied(o)) return self.resolve("-repr").invoke(o)
        if (o.repr instanceof Function) return o.repr()

        if (dict_pred(o)) {
            return `{${Array.from(o, ([k,v])=>print_str(k)+' '+print_str(v)).join(', ')}}`
        }

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

        if (o?.constructor) {
            return "#js:" + o[Symbol.toStringTag]() + " {" +Object.keys(o).map(k=>":"+k+" "+print_str(o[k])).join(", ") + "}"
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

export function filter(pred, coll) {
    const res = []
    let el = []
    while (seq(coll)) {
        el = first(coll)
        coll = rest(coll)
        if (pred(el)) {
            res.push(el)
        }
    }
    return list(...res)
}
self.intern("filter", filter)

export function remove(pred, coll) {
    return filter(complement(pred), coll)
}
self.intern("remove", remove)

export function complement(pred) {
    return (el)=>!pred(el)
}
self.intern("complement", complement)

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

export function assoc(m, k, v) {
    return self.resolve("-assoc").invoke(m, k, v)
}
self.intern("assoc", assoc)

export function dissoc(m, k) {
    return self.resolve("-dissoc").invoke(m, k)
}
self.intern("dissoc", dissoc)

export function get(m, k, fallbak) {
    return self.resolve("-get").invoke(m, k, fallback)
}
self.intern("get", get)

export function keys(m) {
    return self.resolve("-keys").invoke(m)
}
self.intern("keys", keys)

export function vals(m) {
    return self.resolve("-vals").invoke(m)
}
self.intern("vals", vals)

self.intern("meta", meta)
self.intern("reset-meta", reset_meta)
export function alter_meta(o, f, ...args) {
    const new_meta = f(meta(o), ...args)
    reset_meta(o, new_meta)
    return new_meta
}
self.intern("alter-meta!", alter_meta)

////////////////////////////////////////////////////////////////////////////////

export const Eq = define_protocol(
    self, "Eq",
    [["=", [[["this", "that"], "Check equality"]]]])

extend_protocol(Eq, "number", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "string", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "undefined", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "boolean", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, "null", [["=", 2, function(self, other) {return self === other}]])
extend_protocol(Eq, Array, [["=", 2, function(a, b) {return self.resolve("=").invoke(seq(a), seq(b))}]])

export const Conjable = define_protocol(
    self, "Conjable",
    [["-conj", [[["this", "e"], "Return a collection with the element added"]]]])

extend_protocol(Conjable, "null", [["-conj", 2, function(_, e) {return list(e)}]])

export const Associative = define_protocol(
    self, "Associative",
    [["-assoc", [[["this", "k", "v"], "Associate the given value with the given key"]]],
     ["-dissoc", [[["this", "k", "v"], "Remove the association between the thegiven key and value"]]]])

export const Lookup = define_protocol(
    self, "Lookup",
    [["-get", [[["this", "k"], "Get the value associated with k, or null/undefined if absent."],
               [["this", "k", "default"], "Get the value associated with k, or default"]]]])

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
