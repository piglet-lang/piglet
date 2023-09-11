// Copyright (c) Arne Brasseur 2023. All rights reserved.

import AbstractIdentifier from "./lang/AbstractIdentifier.mjs"
import Context from "./lang/Context.mjs"
import Keyword, {keyword} from "./lang/Keyword.mjs"
import PrefixName from "./lang/PrefixName.mjs"
import QName from "./lang/QName.mjs"
import QSym from "./lang/QSym.mjs"
import Sym, {symbol} from "./lang/Sym.mjs"

import AbstractSeq from "./lang/AbstractSeq.mjs"
import Cons from "./lang/Cons.mjs"
import Dict from "./lang/Dict.mjs"
import IteratorSeq from "./lang/IteratorSeq.mjs"
import LazySeq from "./lang/LazySeq.mjs"
import List from "./lang/List.mjs"
import Range from "./lang/Range.mjs"
import Repeat from "./lang/Repeat.mjs"
import SeqIterator from "./lang/SeqIterator.mjs"
import HashSet, {set} from "./lang/HashSet.mjs"

import Module from "./lang/Module.mjs"
import ModuleRegistry from "./lang/ModuleRegistry.mjs"
import Package from "./lang/Package.mjs"
import Var from "./lang/Var.mjs"

import StringReader from "./lang/StringReader.mjs"
import {meta, set_meta, reset_meta} from "./lang/metadata.mjs"
import {mark_as_piglet_object, piglet_object_p} from "./lang/piglet_object.mjs"
import {PIGLET_PKG, munge, unmunge, partition_n, partition_n_step, partition_all_n_step, gensym, assert, assert_type} from "./lang/util.mjs"

import Protocol from "./lang/Protocol.mjs"

import Associative from "./lang/protocols/Associative.mjs"
import Conjable from "./lang/protocols/Conjable.mjs"
import Counted from "./lang/protocols/Counted.mjs"
import Derefable from "./lang/protocols/Derefable.mjs"
import DictLike from "./lang/protocols/DictLike.mjs"
import Empty from "./lang/protocols/Empty.mjs"
import Eq from "./lang/protocols/Eq.mjs"
import Hashable from "./lang/protocols/Hashable.mjs"
import Lookup from "./lang/protocols/Lookup.mjs"
import MutableAssociative from "./lang/protocols/MutableAssociative.mjs"
import MutableCollection from "./lang/protocols/MutableCollection.mjs"
import Named from "./lang/protocols/Named.mjs"
import QualifiedName from "./lang/protocols/QualifiedName.mjs"
import Repr from "./lang/protocols/Repr.mjs"
import Seq from "./lang/protocols/Seq.mjs"
import Seqable from "./lang/protocols/Seqable.mjs"
import Sequential from "./lang/protocols/Sequential.mjs"
import Swappable from "./lang/protocols/Swappable.mjs"
import TaggedValue from "./lang/protocols/TaggedValue.mjs"
import Walkable from "./lang/protocols/Walkable.mjs"
import WithMeta from "./lang/protocols/WithMeta.mjs"

import {hash_code, hash_bytes, hash_str, hash_combine, hash_num} from "./lang/hashing.mjs"
export {hash_code, hash_bytes, hash_str, hash_combine, hash_num}
export const module_registry = ModuleRegistry.instance()

const pkg_piglet = module_registry.ensure_package(PIGLET_PKG)
const self = module_registry.ensure_module(PIGLET_PKG, "lang")
export default self

self.intern('module-registry', module_registry)
self.intern('*current-module*', self)
self.intern('*current-package*', pkg_piglet)
self.intern('*current-context*', self.context)
self.intern('*current-location*', import.meta.url)
self.intern('*verbosity*', 0)

// Intern classes
;[
    AbstractIdentifier, AbstractSeq, Cons, Context, Dict, IteratorSeq, Keyword,
    LazySeq, List, Module, Package, PrefixName, Protocol, QName, QSym, Range,
    Repeat, SeqIterator, Sym, Var, HashSet
].forEach(klz => { self.intern(klz.name, klz); mark_as_piglet_object(klz.prototype) })

// Interns protocols and their methods
;[
    Associative, Conjable, Counted, Derefable, DictLike, Eq, Empty, Hashable,
    Lookup, MutableAssociative, MutableCollection, Named, Repr, Seq, Seqable,
    Sequential, Swappable, TaggedValue, Walkable, WithMeta, QualifiedName
].forEach(proto => { proto.intern(self); mark_as_piglet_object(proto) })

const deref = Derefable.deref
export {deref}

self.intern("*seq-print-limit*", 100)
self.intern("*qname-print-style*", keyword("compact"))
self.intern("*compiler*", null)
const print_depth = self.intern("*print-depth*", 0)
const print_max_depth = self.intern("*print-max-depth*", 12)
const print_stack = self.intern("*print-stack*", set())
const data_readers = self.intern("*data-readers*", Dict.of(null))
export {data_readers}

self.intern("meta", meta)
self.intern("set-meta!", set_meta)
self.intern("reset-meta!", reset_meta)
self.intern("mark-as-piglet-object", mark_as_piglet_object)
self.intern("piglet-object?", piglet_object_p)
self.intern("assert", assert)
self.intern("hash", hash_code)
self.intern("hash-bytes", hash_bytes)
self.intern("hash-str", hash_str)
self.intern("hash-combine", hash_combine)
self.intern("hash-num", hash_num)

self.intern("list-ctor", function(meta, ...args) {return new List(Array.from(args))})
self.intern("set-ctor", function(meta, ...args) {return HashSet.of(meta, ...args)})
self.intern("dict-ctor", function(meta, ...args) {return Dict.of(meta, ...args)})

const kw_async = keyword("async")
const kw_compact = keyword('compact')

export function list(...args) { return self.resolve("list-ctor")(null, ...args) }
self.intern("list", list)

export function range(...args) {
    switch (args.length) {
    case 0: return Range.range0(...args);
    case 1: return Range.range1(...args);
    case 2: return Range.range2(...args);
    case 3: return Range.range3(...args);
    }
}
self.intern("range", range)

export function symbol_p(s) {
    return s instanceof Sym
}
self.intern("symbol?", symbol_p)

export function js_symbol_p(s) {
    return typeof s === 'symbol'
}
self.intern("js-symbol?", symbol_p)

export {keyword, symbol, set}
self.intern("keyword", keyword)
self.intern("symbol", symbol)
self.intern("set", set)

export function keyword_p(o) {return o instanceof Keyword}
self.intern("keyword?", keyword_p)

export function qname(name, separator, suffix) {
    if (name instanceof PrefixName && separator === undefined && suffix === undefined) {
        return Context.expand(deref(resolve(symbol("*current-context*"))), name)
    }
    return new QName(null, name, separator, suffix)
}
self.intern("qname", qname)

export function qsym(name) {return new QSym(null, name)}
self.intern("qsym", qsym)

export function prefix_name(prefix, suffix) {
    if (suffix === undefined) {
        return PrefixName.parse(prefix)
    }
    return new PrefixName(null, prefix, suffix)
}
self.intern("prefix-name", prefix_name)

export function prefix_name_p(o) {return o instanceof PrefixName}
self.intern("prefix-name?", prefix_name_p)

export function qname_p(o) {return o instanceof QName}
self.intern("qname?", qname_p)

export function qsym_p(o) {return o instanceof QSym}
self.intern("qsym?", qsym_p)

export function expand_qnames(o) {
    const postwalk = resolve(symbol('piglet:lang:postwalk'))
    const current_context = resolve(symbol('piglet:lang:*current-context*'))
    return postwalk((v)=>(v instanceof PrefixName ? Context.expand(deref(current_context), v) : v), o)
}
self.intern("expand-qnames", expand_qnames)

export function name(o) {
    if (o == null) return null
    if (typeof o === 'string') {
        return o
    }
    if (Named.satisfied(o)) {
        return Named._name(o)
    }
    return `${o}`
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
    const t = typeof o
    if (o && (t === "object" || t === "function") && o.constructor)
        return o.constructor
    return t
}
self.intern("type", type)

export function fqn(o) {
    return QualifiedName._fqn(o)
}
self.intern("fqn", fqn)

export function find_package(pkg) {
    if (pkg instanceof QSym) {
        return module_registry.find_package(fqn(pkg))
    }
    if (pkg instanceof String) {
        if (pkg.includes("://")) {
            return module_registry.find_package(pkg)
        }
        const fqn = deref(self.resolve("*current-package*")).resolve_alias(pkg)
        if (fqn) {
            return module_registry.find_package(fqn)
        }
    }
    if (pkg instanceof Sym) {
        const fqn = deref(self.resolve("*current-package*")).resolve_alias(name(pkg))
        if (fqn) {
            return module_registry.find_package(fqn)
        }
    }
    return null
}
self.intern("find-package", find_package)

export function find_module(pkg, mod) {
    if (mod === undefined) { // called with one argument
        if (pkg instanceof Sym) {
            const mod_name = pkg.name
            const pkg_name = pkg.mod
            const resolved_alias = deref(self.resolve("*current-module*")).resolve_alias(mod_name)
            if (resolved_alias) return resolved_alias
            return find_module(
                pkg.mod || deref(self.resolve("*current-package*")).name,
                pkg.name)
        }
        if (pkg instanceof QSym) {
            return find_module(pkg.pkg, pkg.mod)
        }
        throw new Error("Unexpected argument to find_module", inspect(pkg), inspect(mod))
    }
    assert_type(pkg, 'string')
    assert(mod === null || typeof mod === 'string')
    if (pkg.includes("://")) {
        return module_registry.find_module(pkg, mod)
    } else {
        pkg = self.resolve("*current-package*").deref().resolve_alias(pkg)
    }
    return module_registry.find_module(pkg, mod)
}
self.intern("find-module", find_module)

export function ensure_module(pkg, mod) {
    if (!mod && pkg instanceof PrefixName) {
        throw `PrefixName used for module identifier, use sym/qsym`
    }
    if (!pkg.includes("://")) {
        pkg = self.resolve("*current-package*").deref().resolve_alias(pkg)
    }
    return module_registry.ensure_module(pkg, mod)
}
self.intern("ensure-module", ensure_module)

export function resolve(sym) {
    let module = self.resolve("*current-module*").deref()
    if (sym instanceof QSym) {
        return find_module(sym.pkg, sym.mod)?.resolve(sym.name)
    }
    if (sym instanceof Sym) {
        if (sym.pkg) {
            module = find_module(sym.pkg, sym.mod)
        } else {
            if(sym.mod) {
                if (module.resolve_alias(sym.mod)) {
                    module = module.resolve_alias(sym.mod)
                    assert(module instanceof Module)
                } else {
                    module = find_module(module.pkg, sym.mod)
                }
            }
        }
        return module?.resolve(sym.name)
    }
    throw new Error(`resolve takes a Sym or QSym, got ${inspect(sym)} ${typeof sym}`)
}
self.intern("resolve", resolve)

export function inspect(value) {
    if (value?.inspect) {
        return value.inspect()
    }
    if (value === null) {
        return "nil"
    }
    return print_str(value)
}
self.intern("inspect", inspect)

export function intern(sym, val, meta) {
    let mod = self.resolve("*current-module*").deref()
    return ensure_module(sym.pkg || mod.pkg, sym.mod || mod.name).intern(sym.name, val, meta)
}
self.intern("intern", intern)

export function conj(coll, o, ...rest) {
    if (rest.length > 0) {
        return [...rest].reduce((acc,e)=>conj(acc,e), conj(coll,o))
    }
    // Allow collection-specific
    if (Conjable.satisfied(coll)) {
        return Conjable._conj(coll, o)
    }
    // Seq-like things don't necessarily need to implement -conj, we default to cons
    if (seq_p(coll) || seqable_p(o)) {
        return cons(o, coll)
    }
    // Throws "protocol not implemented"
    return Conjable._conj(coll, o)
}
self.intern("conj", conj)

export function conj_BANG(coll, o, ...rest) {
    if (rest.length > 0) {
        return [...rest].reduce((acc,e)=>conj_BANG(acc,e), conj_BANG(coll,o))
    }
    return MutableCollection._conj_$BANG$_(coll, o)
}
self.intern("conj!", conj_BANG)

export function cons(val, s) {
    return new Cons(val, Seq.satisfied(s) ? s : seq(s))
}
self.intern("cons", cons)

export function satisfies_p(protocol, obj) {
    return protocol.satisfied(obj)
}
self.intern("satisfies?", satisfies_p)

export {munge, unmunge, partition_n}
self.intern("munge", munge)
self.intern("unmunge", unmunge)
self.intern("partition", partition_n_step)
self.intern("partition-all", partition_all_n_step)

export function object_p(o) {
    return o != null && !Array.isArray(o) && !piglet_object_p(o) && "object" === typeof o
}
self.intern("object?", object_p)

export function fn_p(o) {
    return typeof o === 'function' && !piglet_object_p(o)
}
self.intern("fn?", fn_p)

export function array_p(o) {
    return Array.isArray(o)
}
self.intern("array?", array_p)

export function iterator_p(o) {
    return o && fn_p(o.next)
}
self.intern("iterator?", iterator_p)

export function iterable_p(o) {
    return !!o?.[Symbol.iterator]
}
self.intern("iterable?", iterable_p)

export function iterator(o) {
    if (iterator_p(o)) {
        return o
    }
    if (iterable_p(o)) {
        return o[Symbol.iterator]()
    }
    if (seq_p(o)) {
        return new SeqIterator(o)
    }
    if (seqable_p(o)) {
        return new SeqIterator(seq(o))
    }
}
self.intern("iterator", iterator)

export function seq_p(o) {
    return o != null && Seq.satisfied(o)
}
self.intern("seq?", seq_p)

export function nil_p(o) {
    return o == null
}
self.intern("nil?", nil_p)

export function seqable_p(o) {
    return Seqable.satisfied(o)
}
self.intern("seqable?", seqable_p)

export function sequential_p(o) {
    return Sequential.satisfied(o)
}
self.intern("sequential?", sequential_p)

export function dict(...kvs) {
    return self.resolve("dict-ctor")(null, ...kvs)
}
self.intern("dict", dict)

export function dict_p(o) {
    return DictLike.satisfied(o)
}
self.intern("dict?", dict_p)

export function vector_p(o) {
    return Array.isArray(o) // :P no real vectors yet
}
self.intern("vector?", vector_p)

export function set_p(o) {
    return o instanceof HashSet
}
self.intern("set?", set_p)

export function seq(o) {
    if (null === o || undefined === o) {
        return null
    }
    if (Empty.satisfied(o) && Empty._empty_$QMARK$_(o)) {
        return null
    }
    if (Seq.satisfied(o)) {
        return o
    }
    if (iterator_p(o)) {
        return IteratorSeq.of(o)
    }
    if (iterable_p(o)) {
        return IteratorSeq.of(iterator(o))
    }
    if (seqable_p(o)) {
        return Seqable._seq(o)
    }
    throw new Error("" + o + " is not seqable")
}
self.intern("seq", seq)

export function first(o) {
    return Seq._first(seq(o))
}
self.intern("first", first)

export function second(o) {
    return first(rest(o))
}
self.intern("second", second)

export function nth(o, n) {
    if (n < 0) {
        return nth(reverse(o), -n-1)
    }
    while (n > 0) {
        o = rest(o)
        n--
    }
    return first(o)
}
self.intern("nth", nth)

export function rest(o) {
    if (Seq.satisfied(o)) {
        return Seq._rest(o)
    } else {
        return Seq._rest(seq(o))
    }
}
self.intern("rest", rest)

export function make_lazy_seq(thunk) {
    return new LazySeq(thunk)
}
self.intern("make-lazy-seq", make_lazy_seq)

function seq_str(s) {
    let remaining = deref(self.resolve("*seq-print-limit*"))
    if (!seq(s)) {
        return "()"
    }
    let res = "(" + print_str(first(s))
    remaining--
    s = rest(s)
    while (s) {
        if (remaining === 0) {
            return res + " ...)"
        }
        res += " " + print_str(first(s))
        s = rest(s)
        remaining--
    }
    return res + ")"
}

function array_str(a) {
    const limit = deref(self.resolve("*seq-print-limit*"))
    if (a.length > limit) {
        return `[${Array.from(a.slice(0, limit), (o)=>print_str(o)).join(", ")}, ...]`
    }
    return `[${Array.from(a, (x)=>print_str(x)).join(", ")}]`
}
self.intern("array-str", array_str)

function object_string_tag(o) {
    return o[Symbol.toStringTag]
}
self.intern("object-string-tag", object_string_tag)

function _print_safe_object_lookup(o, k) {
    try {
        return o[k]
    } catch(_) {
        return "...print-error..."
    }
}

export function print_str(o, ...args) {
    if (args.length > 0) {
        return `${print_str(o)} ${print_str(...args)}`
    }
    try {
        if (print_depth.value > print_max_depth.value) {
            return "...*print-max-depth* exceeded..."
        }
        if (print_stack.value.has(o)) {
            return "...circular..."
        }
        print_depth.push_binding(print_depth.value + 1)
        if (o === undefined) return "undefined"
        try {
            print_stack.push_binding(print_stack.value.conj(o))
            if (Repr.satisfied(o)) return Repr._repr(o)
            if (TaggedValue.satisfied(o)) return `#${TaggedValue._tag(o)} ${print_str(TaggedValue._tag_value(o))}`
            if (typeof o === 'object') {
                let s = ""
                if (meta(o)) {
                    s+=`^${print_str(meta(o))} `
                }
                if(seq_p(o)) return s + seq_str(o)

                if (o.toString && o.toString !== {}.toString) return s+o.toString()

                if (o?.constructor) {
                    const tag_name = (o[Symbol.toStringTag] || o.constructor?.name)
                    if (typeof o.toJSON === 'function') {o = o.toJSON() || o}
                    if (tag_name !== "Object") {
                        return s + "#js:" + tag_name + " {" +Object.keys(o).map(k=>":"+k+" "+print_str(_print_safe_object_lookup(o,k))).join(", ") + "}"
                    }
                }
                if (typeof o.toJSON === 'function') {o = o.toJSON()}
                return s + "#js {" + Object.keys(o).map(k=>":"+k+" "+print_str(_print_safe_object_lookup(o,k))).join(", ") + "}"
            }
        } finally {
            print_stack.pop_binding()
        }
        return `${o}`
    } finally {
        print_depth.pop_binding()
    }
}
self.intern("print-str", print_str)

export function println(...args) {
    console.log(...Array.from(args, (a)=>(typeof a === 'string') ? a : print_str(a)))
    return null
}
self.intern("println", println)

export function prn(...args) {
    console.log(...Array.from(args, (a)=>print_str(a)))
    return null
}
self.intern("prn", prn)

export class Reduced {
    constructor(value) {
        this.value = value
    }
}
self.intern("Reduced", Reduced)

export function reduced(value) {
    return new Reduced(value)
}
self.intern("reduced", reduced)

export function reduced_p(o) {
    return o instanceof Reduced
}
self.intern("reduced?", reduced_p)

export function reduce(rf, ...args) {
    let coll, acc
    const async_p = get(meta(rf), kw_async)
    if (args.length == 2) {
        acc = args[0]
        coll = args[1]
    } else {
        coll = args[0]
        acc = first(coll)
        coll = rest(coll)
    }
    if (async_p) {
        function next(acc) {
            acc = rf(acc, first(coll))
            coll = rest(coll)
            return acc
        }
        if (seq(coll)) acc = next(acc)
        acc = acc.then((acc)=>{
            if (reduced_p(acc)) return acc.value
            if (seq(coll)) return next(acc)
            return acc
        })
    } else {
        if (iterable_p(coll)) {
            for (const val of coll) {
                acc = rf(acc, val)
                if (reduced_p(acc)) return acc.value
            }
            return acc
        }
        while (seq(coll)) {
            acc = rf(acc, first(coll))
            if (reduced_p(acc)) return acc.value
            coll = rest(coll)
        }
    }
    return acc
}
self.intern("reduce", reduce)

export function map(f, ...colls) {
    // convert iterators to seq once, so we don't try to
    // consume them multiple times
    colls = colls.map(seq)
    const res = []
    let args = []
    while (colls.every((c)=>c)) {
        if (res.length === 64) {
            const concat = self.resolve("concat")
            if (concat) {
                return concat(
                    res,
                    make_lazy_seq(()=>map(f, ...colls))
                )
            }
        }
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

export function reverse(coll) {
    return reduce((acc,e)=>cons(e,acc), null, coll)
}
self.intern("reverse", reverse)

export function complement(pred) {
    return (el)=>!pred(el)
}
self.intern("complement", complement)

export function plus(a,b) {
    switch(arguments.length) {
    case(0):
        return 0
    case(1):
        return a
    case(2):
        return a + b
    default:
        const acc = 0
        for (const arg of arguments) acc += arg
        return acc
    }
}
self.intern("+", plus)

export function minus(a, b) {
    switch(arguments.length) {
    case(0):
        return 0
    case(1):
        return -a
    case(2):
        return a - b
    default:
        const acc = a
        for (const arg of Array.prototype.slice.call(arguments, 1)) acc -= arg
        return acc
    }
}
self.intern("-", minus)

export function multiply(a, b) {
    switch(arguments.length) {
    case(0):
        return 1
    case(1):
        return a
    case(2):
        return a * b
    default:
        const acc = a
        for (const arg of arguments) acc *= arg
        return acc
    }
}
self.intern("*", multiply)

export function divide(a, b) {
    switch(arguments.length) {
    case(0):
        return 1
    case(1):
        return a
    case(2):
        return a / b
    default:
        const acc = a
        for (const arg of Array.prototype.slice.call(arguments, 1)) acc /= arg
        return acc
    }
}
self.intern("/", divide)

export function string_reader(source, filename) {
    return new StringReader(source, filename, data_readers.value.toJSON())
}
self.intern("string-reader", string_reader)

export function read_string(s) {
    return string_reader(s).read()
}
self.intern("read-string", read_string)

export function str(...args) {
    return args.map((a)=>nil_p(a) ? "" : string_p(a) ? a : print_str(a)).join("")
}
self.intern("str", str)

export function string_p(o) {
    return typeof o === 'string'
}
self.intern("string?", string_p)

export function assoc(m, k, v, ...args) {
    if (args.length > 0) {
        return apply(assoc, assoc(m, k, v), args)
    }
    const res = Associative._assoc(m, k, v)
    return (meta(m) && WithMeta.satisfied(res)) ? with_meta(res, meta(m)) : res
}
self.intern("assoc", assoc)

export function assoc_$BANG$_(m, k, v, ...args) {
    if (args.length > 0) {
        return apply(assoc_$BANG$_, assoc_$BANG$_(m, k, v), args)
    }
    const res = MutableAssociative._assoc_$BANG$_(m, k, v)
    return res
}
self.intern("assoc!", assoc_$BANG$_)

export function dissoc(m, k, ...args) {
    if (args.length > 0) {
        return apply(dissoc, dissoc(m,k), args)
    }
    const res = Associative._dissoc(m, k)
    return (meta(m) && WithMeta.satisfied(res)) ? with_meta(res, meta(m)) : res
}
self.intern("dissoc", dissoc)

export function dissoc_$BANG$_(m, k) {
    return MutableAssociative._dissoc_$BANG$_(m, k)
}
self.intern("dissoc!", dissoc_$BANG$_)

export function get(m, k, fallback) {
    if (Lookup.satisfied(m)) {
        if (fallback === undefined) {
            return Lookup._get(m, k)
        }
        return Lookup._get(m, k, fallback)
    }
    const prop = js_symbol_p(k) ? k : name(k)
    if (fallback === undefined) {
        return m[prop]
    }
    return prop in m ? m[prop] : fallback
}
self.intern("get", get)

export function keys(m) {
    if (DictLike.satisfied(m)) {
        return DictLike._keys(m)
    }
    return Object.keys(m)
}
self.intern("keys", keys)

export function vals(m) {
    if (DictLike.satisfied(m)) {
        return DictLike._vals(m)
    }
    return Object.values(m)
}
self.intern("vals", vals)

export function alter_meta(o, f, ...args) {
    const new_meta = f(meta(o), ...args)
    reset_meta(o, new_meta)
    return new_meta
}
self.intern("alter-meta!", alter_meta)

export function count(coll) {
    if (coll == null) {
        return 0
    }
    if (Counted.satisfied(coll)) {
        return Counted._count(coll)
    }
    if (iterable_p(coll)) {
        let acc = 0
        for (const _ of coll) acc+=1
        return acc
    }
    const s = seq(coll)
    if (s) {
        return reduce((acc,_)=>acc+1, 0, s)
    }
    throw new Error("Unable to count ${coll && coll?.inpect ? coll.inspect() : coll}")
}
self.intern("count", count)

function seq_eq(self, other) {
    if (self === other) return true
    if (!sequential_p(other)) return false
    if (Counted.satisfied(self) && Counted.satisfied(other)) {
        if (Counted._count(self) !== Counted._count(other)) return false
        if (Counted._count(self) === 0) return true
    }
    let xa = first(self)
    let xb = first(other)
    if (!eq(xa, xb)) return false
    while (self && other) {
        self = rest(self)
        other = rest(other)
        xa = first(self)
        xb = first(other)
        if (!eq(xa, xb)) return false
    }
    if (null === self && null === other) return true
    return false
}

function eq2(a, b) {
    if (a === b) return true
    if (hash_code(a) !== hash_code(b)) return false
    if (Eq.satisfied(a)) return Eq._eq(a, b)

    if (sequential_p(a)) {
        if (!sequential_p(b)) return false
        const ca = count(a)
        const cb = count(b)
        if (ca !== cb) return false
        if (ca === 0) return true
        if (iterable_p(a) && iterable_p(b)) {
            const ia = iterator(a)
            const ib = iterator(b)
            while (true) {
                let va = ia.next()
                let vb = ib.next()
                if (va.done !== vb.done) return false
                if (va.done) return true
                if (eq2(va.value, vb.value)) {
                    va = ia.next()
                    vb = ib.next()
                }
            }
        }
        return seq_eq(a, b)
    }

    if (dict_p(a)) {
        if (!dict_p(b)) return false
        if (count(a) !== count(b)) return false
        if (count(a) === 0) return true
        for (const k of keys(a)) {
            if (!eq2(get(a, k), get(b, k))) return false
        }
        return true
    }

    // We do recurse into the prototype, and we do consider full piglet value
    // equality for object values. We don't consider Symbol properties.
    if (object_p(a)) {
        if (!object_p(b)) return false
        if (!eq2(Object.getPrototypeOf(a), Object.getPrototypeOf(b))) return false
        if (Object.keys(a).length !== Object.keys(b).length) return false
        for (const k of Object.getOwnPropertyNames(a)) if (!eq2(a[k], b[k])) return false
        return true
    }

    return false
}

export function eq(a, b) {
    switch(arguments.length) {
    case(0):
    case(1): return true
    case(2): return eq2(a,b)
    default:
        if (eq2(a,b)) {
            for (const o of Array.prototype.slice.call(arguments, 2))
                if (!eq2(a,o)) return false
            return true
        }
        return false
    }
}
self.intern("=", eq, dict(keyword("tag"), symbol("boolean")))

export function truthy_p(v) {
    return v !== false && v !== null && v !== undefined
}
self.intern("truthy?", truthy_p, dict(keyword("tag"), symbol("boolean")))

export function falsy_p(v) {
    return v === false || v === null || v === undefined
}
self.intern("falsy?", falsy_p, dict(keyword("tag"), symbol("boolean")))

export function and(... args) {
    let ret = null
    for(let a of args) {
        if (falsy_p(a)) return false
        ret = a
    }
    return ret
}
self.intern("and", and)

export function or(... args) {
    for(let a of args) {
        if (truthy_p(a)) return a
    }
    return args.slice(-1)[0]
}
self.intern("or", or)

export function not(v) {
    return falsy_p(v) ? true : false
}
self.intern("not", not)

export {gensym}
self.intern("gensym", gensym)

export function require(mod) {
    if (symbol_p(mod)) { // resolve sym to qsym
        if (mod.mod) {
            mod = qsym(`${deref(self.resolve("*current-package*")).resolve_alias(mod.mod)}:${mod.name}`)

        } else {
            mod = qsym(`${deref(self.resolve("*current-package*")).name}:${mod}`)
        }
    }
    return self.resolve("*compiler*").deref().require(mod)
}
self.intern("require", require)

export async function js_import(mod_path) {
    const mod = module_registry.resolve_module(deref(self.resolve("*current-package*")).name, mod_path)
    if (mod.required) {
        return mod
    }
    const compiler = deref(resolve(symbol("piglet:lang:*compiler*")))
    let path
    if (compiler) {
        path=compiler.resolve_js_path(mod_path)
        if (!path) {
            throw new Error(`Could not find JS module ${mod_path} in ${fqn(deref(resolve(symbol("*current-module*"))))}`)
        }
    } else {
        path=mod_path
    }
    // import(.., {assert: {type: "json"}}) is non-standard, not supported in
    // Firefox and Operai
    // const imported = await (path.endsWith(".json") ?
    // import(/* @vite-ignore */ path, {assert: {type: "json"}}) :
    // import(/* @vite-ignore */ path))
    const imported = await (import(/* @vite-ignore */ path))
    for(const [k, v] of Object.entries(imported)) {
        mod.intern(unmunge(k), v)
    }
    mod.is_js_import = true
    mod.required = true
    return mod
}
self.intern("js-import", js_import)

self.intern("eval", async function(form) {
    if (!self.resolve("*compiler*").deref()) {
        throw new Error("No compiler present, can't eval.")
    }
    return await self.resolve("*compiler*").deref().eval(form)
})

export function apply(fn, ...args) {
    return fn.apply(null, args.slice(0,-1).concat(Array.from(seq(args.slice(-1)[0]) || [])))
}
self.intern("apply", apply)

export function butlast(arg) {
    if (nil_p(arg)) return list()
    return Array.from(arg).slice(0, -1)
}
self.intern("butlast", butlast)

export function last(arg) {
    if (nil_p(arg)) return null
    const arr = Array.from(arg)
    if (arr.length === 0) return null
    return arr.slice(-1)[0]
}
self.intern("last", last)

export function with_meta(o, m) {
    // println(with_meta(o, m))
    if (eq(m, meta(o))) {
        return o
    }
    if (WithMeta.satisfied(o)) {
        // println("satisfied!")
        return WithMeta._with_meta(o, m)
    }
    throw new Error(`Object ${print_str(o)} ${o?.constructor?.name} does not implement WithMeta`)
}
self.intern("with-meta", with_meta)

export function swap_$BANG$_(o, f, ...args) {
    return Swappable._swap_$BANG$_(o, f, args)
}
self.intern("swap!", swap_$BANG$_)

export function postwalk(f, i) {
    let o = f(Walkable.satisfied(i) ? Walkable._walk(i, (v)=>postwalk(f, v)) : i)
    if (meta(i)) {
        if (WithMeta.satisfied(o))
            o = with_meta(o, meta(i))
        else
            o = set_meta(o, meta(i))
    }
    if (Object.isFrozen(o)) Object.freeze(o)
    else if (Object.isSealed(o)) Object.seal(o)
    return o
}
self.intern("postwalk", postwalk)

export function prewalk(f, i) {
    let o = f(i)
    o = (Walkable.satisfied(o) ? Walkable._walk(o, (v)=>prewalk(f, v)) : o)
    if (meta(i)) {
        if (WithMeta.satisfied(o))
            o = with_meta(o, meta(i))
        else
            o = set_meta(o, meta(i))
    }
    if (Object.isFrozen(o)) Object.freeze(o)
    else if (Object.isSealed(o)) Object.seal(o)
    return o
}
self.intern("prewalk", prewalk)

export function select_keys(d, keyseq) {
    if (d == null) return null
    const kvs = []
    for (const k of keyseq) {
        if (d.has(k)) {
            kvs.push(k)
            kvs.push(get(d, k))
        }
    }
    return apply(dict, kvs)
}
self.intern("select-keys", select_keys)

////////////////////////////////////////////////////////////////////////////////

Associative.extend(
    null,
    [function _assoc(_, k, v) { return dict(k, v) },
     function _dissoc(_, k) { return null }],

    Object,
    [function _assoc(o, k, v) { return MutableAssociative._assoc_$BANG$_(Object.assign({}, o), k, v) },
     function _dissoc(o, k)  { return MutableAssociative._dissoc_$BANG$_(Object.assign({}, o), k) }],

    Map,
    [function _assoc(map, k, v) {map = new Map(map); map.set(k, v); return map},
     function _dissoc(map, k) {map = new Map(map); map.delete(k); return map}],

    Set,
    [function _assoc(set, k, v) {
        if (eq(k,v)) {
            set = new Set(set)
            set.add(k)
            return set
        } else throw new Error(`In order to assoc onto a Set, key and value must be equal, got ${print_str(k)}, ${print_str(v)}`)
    },
     function _dissoc(set, k) {set = new Set(set); set.delete(k); return set}],

    Array,
    [function _assoc(arr, idx, v) { return arr.map((el, i)=>i===idx?v:el)}],

    Dict,
    [function _assoc(dict, k, v) { return dict.assoc(k, v)},
     function _dissoc(dict, k) { return dict.dissoc(k)}],

    HashSet,
    [function _assoc(set, k, v) {
        if (eq(k,v)) {
            return set.conj(k)
        } else throw new Error(`In order to assoc onto a Set, key and value must be equal, got ${print_str(k)}, ${print_str(v)}`)
    },
     function _dissoc(set, k) { return set.disj(k)}],
)

Conjable.extend(
    null,
    [function _conj(coll, el) { return cons(el, null)}],

    Object,
    [function _conj(coll, el) { return conj_BANG(Object.assign({}, coll), el)}],

    Array,
    [function _conj(coll, el) { const copy = [...coll]; copy.push(el) ; return copy }],

    Map,
    [function _conj(coll, el) { coll = new Map(coll); coll.set(first(el), first(rest(el))); return coll}],

    Cons,
    [function _conj(coll, el) { return cons(el, coll)}],

    List,
    [function _conj(coll, el) { return coll.conj(el)}],

    Dict,
    [function _conj(coll, kv) { return assoc(coll, first(kv), first(rest(kv)))}],

    HashSet,
    [function _conj(coll, o) { return coll.conj(o)}],

    Context,
    [function _conj(coll, kv) { return assoc(coll, first(kv), first(rest(kv)))}],

    Range,
    [function _conj(coll, el) { return cons(el, coll)}],

    Repeat,
    [function _conj(coll, el) { return cons(el, coll)}],
)

Counted.extend(
    Array, [function _count(coll) { return coll.length }],
    Map, [function _count(coll) { return coll.size }],
    Set, [function _count(coll) { return coll.size }],
    List, [function _count(coll) { return coll.count() }],
    Dict, [function _count(coll) { return coll.count() }],
    HashSet, [function _count(coll) { return coll.count() }],
    Repeat, [function _count(coll) { return coll.count() }],
    Range, [function _count(coll) { return coll.count() }],
)

Derefable.extend(
    Var, [function deref(v) { return v.deref() }]
)

DictLike.extend(
    Map,
    [function _keys(m) {return IteratorSeq.of(m.keys())},
     function _vals(m) {return IteratorSeq.of(m.values())}],

    Dict,
    [function _keys(d) {return IteratorSeq.of(d.keys())},
     function _vals(d) {return IteratorSeq.of(d.values())}],

    // Set / HashSet ?

    Module,
    [function _keys(m) {return m.keys()},
     function _vals(m) {return m.values()}],
)

Empty.extend(
    null, [function _empty_$QMARK$_(_) { return true }],
    AbstractSeq, [function _empty_$QMARK$_(self) { return self.empty() }],
    Dict, [function _empty_$QMARK$_(self) { return self.count() === 0 }],
    Range, [function _empty_$QMARK$_(self) { return self.empty_p() }],
)

Eq.extend(
    null, [function _eq(self, other) { return null === other || undefined === other }],
    Number, [function _eq(self, other) { return self === other }],
    String, [function _eq(self, other) { return self === other }],
    Boolean, [function _eq(self, other) { return self === other }],

    Sym, [function _eq(self, other) { return self.eq(other) }],

    Range,
    [function _eq(self, other) {
        if (other instanceof Range && self.from === other.from && self.to === other.to && self.step == other.step) {
            return true
        }
        return seq_eq(self, other)
    }],

    Repeat,
    [function _eq(self, other) {
        if (other instanceof Repeat && self.count === other.count && self.value === other.value) {
            return true
        }
        return seq_eq(self, other)
    }],

    AbstractIdentifier,
    [function _eq(self, other) {
        return (other instanceof self.constructor && self.toString() == other.toString())
    }],

    HashSet,
    [function _eq(self, other) {
        return (other instanceof self.constructor &&
                self.count() === other.count() &&
                hash_code(self) === hash_code(other) &&
                reduce((acc,o)=>other.has(o) ? acc : reduced(false), true, self))
    }],

    ArrayBuffer,
    [function _eq(self, other) {
        if (other instanceof ArrayBuffer && self.byteLength === other.byteLength) {
            const s = new Int8Array(self)
            const o = new Int8Array(other)
            for (let i = 0 ; i < self.byteLength ; i++) {
                if (s[i] !== o[i]) return false
            }
            return true
        }
        return false
    }]
)

Hashable.extend(
    // builtins
    null, [(function _hash_code(_) { return 0 })],
    Boolean, [(function _hash_code(self) { return self ? 1231 : 1237 })],
    Number, [(function _hash_code(self) { return hash_num(self) })],
    BigInt, [(function _hash_code(self) { return hash_str(self.toString()) })],
    String, [(function _hash_code(self) { return hash_str(self) })],
    Symbol, [(()=>{
        let next_symbol_id = 1
        return function _hash_code(o) {
            const sym_key = Symbol.keyFor(o)
            if (sym_key === undefined) {
                return next_symbol_id++
            }
            return hash_combine(hash_str(sym_key), 1)
        }
    })()],
    RegExp, [(function _hash_code(self) { return hash_str(`%r${self.toString()}`) })],
    Date, [(function _hash_code(self) { return self.valueOf() })],
    Array, [(function _hash_code(self) { return self.map((e)=>hash_code(e)).reduce(hash_combine, 0) })],
    Function, [(function _hash_code(self) { return hash_str(self.toString()) })],

    Object, [(()=>{
        let next_obj_id = 1
        return function _hash_code(o) {
            if (Object.isFrozen(o)) {
                let hsh = hash_code(Object.getPrototypeOf(o))
                for (const p of Object.getOwnPropertyNames(o)) hsh = hash_combine(hsh, hash_combine(hash_str(p), hash_code(o[p])))
                return hsh
            }
            return next_obj_id++
        }
    })()],

    Object.getPrototypeOf(Int8Array),
    [(function _hash_code(self) { return self.map((e)=>hash_code(e)).reduce(hash_combine, 1) })],

    Set,
    [(function _hash_code(self) { return self.map((e)=>hash_code(e)).reduce(hash_combine, 2) })],

    // Piglet
    Sym, [(function _hash_code(self) {
        return hash_combine(
            self.pkg ? hash_str(self.pkg) : 0,
            hash_combine(self.mod ? hash_str(self.mod) : 0,
                         hash_str(self.name)))
    })],
    AbstractSeq, [(function _hash_code(self) { return Array.from(self, (e)=>hash_code(e)).reduce(hash_combine, 0) })],

    Dict,
    [(function _hash_code(self) {
        return Array.from(
            self, ([k,v]) => hash_combine(hash_code(k), hash_code(v))
        ).reduce(hash_combine, 4)})],

    HashSet, [(function _hash_code(self) {
        // We already have the hashes of any set elements in
        // self.entries.keys(), combine them as many times as there are elements
        // in the bucket. Sort them because the order in self.entries will
        // reflect insertion order, and so will differ for otherwise equivalent
        // sets, e.g. #{1 2} vs #{2 1}
        let acc = 5
        for (const hsh of Array.from(self.entries.keys()).sort())
            for (let i = 0 ; i < self.entries.get(hsh).length; i++)
                acc = hash_combine(acc, hsh)
        return acc
    })],
    Keyword, [(function _hash_code(self) { return hash_str(self.inspect())})],

    ArrayBuffer,
    [(function _hash_code(self) {
        return hash_combine(hash_num(self.byteLength),
                            new Int8Array(self).reduce((acc, n)=>hash_combine(acc, hash_num(n)), 0))
    })]

)

Lookup.extend(
    null,
    [function _get(coll, k) { return null},
     function _get(coll, k, fallback) { return fallback}],

    Dict,
    [function _get(coll, k) { return coll.get(k)},
     function _get(coll, k, fallback) { return coll.get(k, fallback)}],

    Map,
    [function _get(coll, k) { return Lookup._get(coll, k, null)},
     function _get(coll, k, v) { return coll.has(k) ? coll.get(k) : reduce((acc, [mk,mv])=>(eq(k, mk) ? reduced(mv) : v), v, coll)}],

    Set,
    [function _get(coll, k) { return Lookup._get(coll, k, null)},
     function _get(coll, k, v) { return coll.has(k) ? k : reduce((acc, o)=>(eq(k, o) ? reduced(o) : v), v, coll)}],

    HashSet,
    [function _get(coll, o) { return coll.has(o) ? o : null },
     function _get(coll, o, fallback) { return coll.has(o) ? o : fallback }],

    Array,
    [function _get(arr, idx) { return idx in arr ? arr[idx] : null },
     function _get(arr, idx, fallback) { return idx in arr ? arr[idx] : fallback}],

    Object.getPrototypeOf(Int8Array),
    [function _get(arr, idx) { return idx in arr ? arr[idx] : null },
     function _get(arr, idx, fallback) { return idx in arr ? arr[idx] : fallback}],

    ArrayBuffer,
    [function _get(arr, idx) {
        throw new Error("Wrap a js:ArrayBuffer in a typed array (e.g. Uint8Array) to access its elements.")
    },
     function _get(arr, idx, fallback)  {
         throw new Error("Wrap a js:ArrayBuffer in a typed array (e.g. Uint8Array) to access its elements.")
     }],

    Module,
    [function _get(mod, k) { return Lookup._get(mod, k, null)},
     function _get(mod, k, fallback) { return mod.lookup(name(k)) || fallback }],
)

MutableAssociative.extend(
    Array,
    [function _assoc_$BANG$_(a, k, v) {
        a[k] = v
        return a
    },
     function _dissoc_$BANG$_(a, k) {
         delete a[k]
         return a
     }],

    ArrayBuffer,
    [function _assoc_$BANG$_(a, k, v) {
        throw new Error("js:ArrayBuffer can't be modified directly, create a wrapping TyppedArray (e.g. Uint8Array)")
    },
     function _dissoc_$BANG$_(a, k) {
         throw new Error("js:ArrayBuffer can't be modified directly, create a wrapping TyppedArray (e.g. Uint8Array)")
     }],

    // hidden TypedArray class
    Object.getPrototypeOf(Int8Array),
    [function _assoc_$BANG$_(a, k, v) {
        a[k] = v
        return a
    },
     function _dissoc_$BANG$_(a, k) {
         delete a[k]
         return a
     }],

    Object,
    [function _assoc_$BANG$_(o, k, v) {
        o = (o == null) ? {} : o
        const n = js_symbol_p(k) ? k : name(k)
        o[n] = v
        return o
    },
     function _dissoc_$BANG$_(o, k) {
         const n = js_symbol_p(k) ? k : name(k)
         delete o[n]
         return o
     }]
)

MutableCollection.extend(
    Array,
    [function _conj_$BANG$_(arr, el) {
        arr.push(el)
        return arr
    }],

    Map,
    [function _conj_$BANG$_(m, el) {
        const [k, v] = el
        return m.set(k, v)
    }],

    Set,
    [function _conj_$BANG$_(s, el) {
        return s.add(el)
    }],

    Object,
    [function _conj_$BANG$_(o, el) {
        const [k, v] = el
        o[name(k)] = v
        return o}]
)

Named.extend(
    AbstractIdentifier,
    [function _name(self) { return self.identifier_str() }]
)

Repr.extend(
    Number, [function _repr(self) {return self.toString()}],
    String, [function _repr(self) {return `"${self.replaceAll('"', '\\"')}"`}],
    null, [function _repr(self) {return "nil"}],
    Boolean, [function _repr(self) {return self.toString()}],
    Symbol, [function _repr(self) {return `#js:Symbol \"${self.description}\"`}],
    Array,  [function _repr(self) {return `#js ${array_str(self)}`}],
    RegExp, [function _repr(self) {return `%r${self.toString()}${self.modifiers || ""}`}],

    ArrayBuffer, [function _repr(self) {return `#js:ArrayBuffer ${array_str(new Uint8Array(self))}`}],
    // hidden TypedArray class
    Object.getPrototypeOf(Int8Array),
    [function _repr(self) {return `#js:${self.constructor.name} ${array_str(self)}`}],

    Map,
    [function _repr(self) {
        return `#js:Map {${Array.from(self, ([k,v])=>[print_str(k), print_str(v)].join(" ")).join(", ")}}`
    }],

    Set,
    [function _repr(self) {
        return `#js:Set {${Array.from(self, (o)=>print_str(o)).join(", ")}}`
    }],

    Dict,
    [function _repr(self) {
        return `{${Array.from(self, ([k,v])=>[print_str(k), print_str(v)].join(" ")).join(", ")}}`
    }],

    HashSet,
    [function _repr(self) {
        return `#{${Array.from(self, (o)=>print_str(o)).join(", ")}}`
    }],

    QName, [function _repr(qname) {
        if (eq(Derefable.deref(self.resolve("*qname-print-style*")), kw_compact) ) {
            return Context.contract(deref(self.resolve("*current-context*")), qname).toString()
        } else {
            return qname.toString()
        }
    }],
    AbstractIdentifier, [function _repr(self) { return self.toString() }],
    AbstractSeq, [function _repr(self) { return seq_str(self) }],

    Var, [function _repr(self) { return self.repr() }],

    Module, [function _repr(self) { return self.repr() }],
    Context, [function _repr(self) { return `#Context ${print_str(self.entries)}` }]
)

Seq.extend(
    null,
    [function _first(self) {return null},
     function _rest(self) {return null}],

    AbstractSeq,
    [function _first(self) {return self.first()},
     function _rest(self) {return self.rest()}]
)

Seqable.extend(
    null, [function _seq(self) {return null}],
    Object, [function _seq(self) {return IteratorSeq.of_iterable(Object.entries(self))}],
    String, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Array, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Map, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Set, [function _seq(self) {return IteratorSeq.of_iterable(self)}],

    Dict, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    HashSet, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    AbstractSeq, [function _seq(self) {return self.seq()}],
    Module, [function _seq(self) { return seq(self.seq())}],
    ArrayBuffer, [function _seq(self) {return IteratorSeq.of(new Uint8Array(self).values())}],

    // hidden TypedArray class
    Object.getPrototypeOf(Int8Array),
    [function _seq(self) {return IteratorSeq.of(self.values())}]
)

Sequential.extend(
    Array, [],
    AbstractSeq, []
)

WithMeta.extend(
    AbstractIdentifier, [function _with_meta(identifier, metadata) {return identifier.with_meta(metadata) }],
    Dict, [function _with_meta(dict, metadata) {return dict.with_meta(metadata)}],
    Keyword, [function _with_meta(kw, metadata) {return kw.with_meta(metadata)}],
    Cons, [function _with_meta(c, metadata) {return c.with_meta(metadata)}],
    List, [function _with_meta(list, metadata) {return list.with_meta(metadata)}],
    HashSet, [function _with_meta(set, metadata) {return set.with_meta(metadata)}],
    // Array, [function _with_meta(arr, metadata) {
    //     if (!eq2(meta(arr), metadata))
    //         return set_meta(Array.from(arr), meta(arr))
    //     return arr
    // }],
)

Walkable.extend(
    Array, [function _walk(self, f) { return Array.from(self, (o)=>f(o)) }],
    Map, [function _walk(self, f) { return new Map(Array.from(self, ([k, v])=>[f(k),f(v)])) }],
    AbstractSeq, [(function _walk(self, f) { return map(f, self) })],
    Dict, [function _walk(self, f) { return Array.from(self, ([k, v])=>[f(k),f(v)]).reduce((acc, [k, v])=>assoc(acc, k, v), dict()) }],
    Set, [function _walk(self, f) { return new Set(meta(self), map(f, self)) }],
    HashSet, [function _walk(self, f) { return HashSet.of(meta(self), ...map(f, self)) }]
)

QualifiedName.extend(
    QName,   [function _fqn(self) { return self.fqn }],
    QSym,    [function _fqn(self) { return self.fqn }],
    Var,     [function _fqn(self) { return self.fqn }],
    Package, [function _fqn(self) { return self.name }],
    Module,  [function _fqn(self) { return self.fqn.toString() }],
)

AbstractSeq.prototype[Symbol.iterator] = function() {
    return new SeqIterator(this)
}
