// Copyright (c) Arne Brasseur 2023. All rights reserved.

import AbstractIdentifier from "./lang/AbstractIdentifier.mjs"
import Context from "./lang/Context.mjs"
import Keyword, {keyword} from "./lang/Keyword.mjs"
import PrefixName from "./lang/PrefixName.mjs"
import QName from "./lang/QName.mjs"
import QSym from "./lang/QSym.mjs"
import Sym from "./lang/Sym.mjs"

import AbstractSeq from "./lang/AbstractSeq.mjs"
import Cons from "./lang/Cons.mjs"
import Dict from "./lang/Dict.mjs"
import IteratorSeq from "./lang/IteratorSeq.mjs"
import List from "./lang/List.mjs"
import Range from "./lang/Range.mjs"
import SeqIterator from "./lang/SeqIterator.mjs"
import LazySeq from "./lang/LazySeq.mjs"
import Repeat from "./lang/Repeat.mjs"

import Var from "./lang/Var.mjs"
import Module from "./lang/Module.mjs"
import ModuleRegistry from "./lang/ModuleRegistry.mjs"

import StringReader from "./lang/StringReader.mjs"
import {meta, reset_meta} from "./lang/metadata.mjs"
import {PIGLET_PKG, munge, unmunge, partition_n, gensym, assert, assert_type} from "./lang/util.mjs"

import Associative from "./lang/protocols/Associative.mjs"
import Conjable from "./lang/protocols/Conjable.mjs"
import Counted from "./lang/protocols/Counted.mjs"
import Derefable from "./lang/protocols/Derefable.mjs"
import DictLike from "./lang/protocols/DictLike.mjs"
import Eq from "./lang/protocols/Eq.mjs"
import Hashable from "./lang/protocols/Hashable.mjs"
import Lookup from "./lang/protocols/Lookup.mjs"
import MutableCollection from "./lang/protocols/MutableCollection.mjs"
import Named from "./lang/protocols/Named.mjs"
import Repr from "./lang/protocols/Repr.mjs"
import Seq from "./lang/protocols/Seq.mjs"
import Seqable from "./lang/protocols/Seqable.mjs"
import Sequential from "./lang/protocols/Sequential.mjs"
import Swappable from "./lang/protocols/Swappable.mjs"
import Walkable from "./lang/protocols/Walkable.mjs"
import WithMeta from "./lang/protocols/WithMeta.mjs"

import {hash_code} from "./lang/hashing.mjs"
export {hash_code}

export const module_registry = new ModuleRegistry()
console.log("MM", module_registry)

const pkg_piglet = module_registry.ensure_package(PIGLET_PKG)
const self = module_registry.ensure_module(PIGLET_PKG, "lang")
export default self

self.intern('module-registry', module_registry)
self.intern('*current-module*', self)
self.intern('*current-package*', pkg_piglet)
self.intern('*current-context*', self.context)

self.intern("AbstractSeq", AbstractSeq)
self.intern("Cons", Cons)
self.intern("Context", Context)
self.intern("Dict", Dict)
self.intern("IteratorSeq", IteratorSeq)
self.intern("Keyword", Keyword)
self.intern("LazySeq", LazySeq)
self.intern("List", List)
self.intern("Named", Named)
self.intern("PrefixName", PrefixName)
self.intern("QName", QName)
self.intern("QSym", QSym)
self.intern("Range", Range)
self.intern("Repeat", Repeat)
self.intern("SeqIterator", SeqIterator)
self.intern("Sym", Sym)

Associative.intern(self)
Conjable.intern(self)
Counted.intern(self)
Derefable.intern(self)
DictLike.intern(self)
Eq.intern(self)
Hashable.intern(self)
Lookup.intern(self)
MutableCollection.intern(self)
Repr.intern(self)
Seq.intern(self)
Seqable.intern(self)
Sequential.intern(self)
Swappable.intern(self)
Walkable.intern(self)
WithMeta.intern(self)

const deref = Derefable.deref
export {deref}

self.intern("*seq-print-limit*", 100)
self.intern("*qname-print-style*", keyword("compact"))
self.intern("*compiler*", null)

self.intern("list-ctor", function(meta, ...args) {return new List(Array.from(args))})
self.intern("dict-ctor", function(meta, ...args) {return Dict.of(meta, ...args)})

export function list(...args) { return self.resolve("list-ctor")(null, ...args) }
self.intern("list", list)

export function range(...args) { return new Range(...args) }
self.intern("range", range)

export function symbol(pkg, mod, name, metadata) {
    if (arguments.length === 1) {
        return Sym.parse(pkg, metadata)
    }
    return new Sym(pkg, mod, name, metadata)
}
self.intern("symbol", symbol)

export function symbol_p(s) {
    return s && s?.constructor === Sym
}
self.intern("symbol?", symbol_p)

export function js_symbol_p(s) {
    return typeof s === 'symbol'
}
self.intern("js-symbol?", symbol_p)

export {keyword}
self.intern("keyword", keyword)

export function keyword_p(o) {return o instanceof Keyword}
self.intern("keyword?", keyword_p)

export function qname(name) {return new QName(null, name)}
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

export function name(o) {
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
    if (o && typeof o === 'object')
        return o.constructor
    return typeof o
}
self.intern("type", type)

export function find_module(pkg, mod) {
    assert(typeof pkg === 'string')
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
    console.log("ensure_module", pkg, mod)
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
    assert_type(sym, Sym)
    let module = self.resolve("*current-module*").deref()
    if (sym instanceof QSym) {
        return find_module(sym.pkg, sym.mod)?.resolve(sym.name)
    }
    if (sym instanceof Sym) {
        if (sym.pkg) {
            module = find_module(sym.pkg, sym.mod)
        } else {
            if(sym.mod) {
                if (module.aliases[sym.mod]) {
                    module = module.aliases[sym.mod]
                    assert(module instanceof Module)
                } else {
                    module = find_module(module.pkg, sym.mod)
                }
            }
        }
        return module?.resolve(sym.name)
    }
    throw new Error("resolve takes a Sym or QSym, got ${sym}")
}
self.intern("resolve", resolve)

export function inspect(value) {
    if (value?.inspect) {
        return value.inspect()
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
    return new Cons(val, seq(s))
}
self.intern("cons", cons)

export function satisfies_p(protocol, obj) {
    return protocol.satisfied(obj)
}
self.intern("satisfies?", satisfies_p)

export {munge, unmunge, partition_n}
self.intern("munge", munge)
self.intern("unmunge", unmunge)
self.intern("partition", partition_n)

export function fn_p(o) {
    return typeof o === 'function'
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
    return !!o[Symbol.iterator]
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

export function seq(o) {
    if (null === o) {
        return null
    }
    if (seqable_p(o)) {
        return Seqable._seq(o)
    }
    if (iterator_p(o)) {
        return IteratorSeq.of(o)
    }
    if (iterable_p(o)) {
        return IteratorSeq.of(iterator(o))
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
        return `[${a.slice(0, limit).map(print_str).join(", ")}, ...]`
    }
    return `[${a.map(print_str).join(", ")}]`
}

export function print_str(o) {
    if (o === undefined) return "undefined"
    if (Repr.satisfied(o)) return Repr._repr(o)

    if (typeof o === 'object') {
        let s = ""
        if (meta(o)) {
            s+=`^${print_str(meta(o))} `
        }
        if(seq_p(o)) return s + seq_str(o)

        if (o.toString && o.toString !== {}.toString) return s+o.toString()

        if (o?.constructor) {
            return s + "#js:" + (o[Symbol.toStringTag] || o.constructor?.name) + " {" +Object.keys(o).map(k=>":"+k+" "+print_str(o[k])).join(", ") + "}"
        }
        return s + "#js {" + Object.keys(o).map(k=>":"+k+" "+print_str(o[k])).join(", ") + "}"
    }
    return `${o}`
}
self.intern("print-str", print_str)

export function println(...args) {
    console.log(...Array.from(args, (a)=>(typeof a === 'string') ? a : print_str(a)))
}
self.intern("println", println)

export function prn(...args) {
    console.log(...Array.from(args, print_str))
}
self.intern("println", println)

export function reduce(rf, ...args) {
    let coll, acc
    if (args.length == 2) {
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

export function reverse(coll) {
    return reduce((acc,e)=>cons(e,acc), null, coll)
}
self.intern("reverse", reverse)

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
    return args.map((a)=>string_p(a) ? a : print_str(a)).join("")
}
self.intern("str", str)

export function string_p(o) {
    return typeof o === 'string'
}
self.intern("string?", string_p)

export function assoc(m, k, v) {
    return Associative._assoc(m, k, v)
}
self.intern("assoc", assoc)

export function dissoc(m, k) {
    return Associative._dissoc(m, k)
}
self.intern("dissoc", dissoc)

export function get(m, k, fallback) {
    if (fallback === undefined) {
        return Lookup._get(m, k)
    }
    return Lookup._get(m, k, fallback)
}
self.intern("get", get)

export function keys(m) {
    return DictLike._keys(m) || list()
}
self.intern("keys", keys)

export function vals(m) {
    return DictLike._vals(m) || list()
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

function count(coll) {
    if (coll == null) {
        return 0
    }
    if (Counted.satisfied(coll)) {
        return Counted._count(coll)
    }
    const s = seq(coll)
    if (s) {
        return reduce((acc,_)=>inc(acc), 0, s)
    }
    throw new Error("Unable to count ${coll && coll?.inpect ? coll.inspect() : coll}")
}
self.intern("count", count)

function seq_eq(self, other) {
    if (self === other) return true
    if (!sequential_p(other)) return false
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

export function eq(o, ...args) {
    if (Eq.satisfied(o)) {
        for (const a of args) {
            if (!(Eq._eq(o, a))) return false
        }
        return true
    }
    if (!seq_p(o) && sequential_p(o)) {
        o = seq(o)
    }
    if (dict_p(o)) {
        for (const other of args) {
            if (!dict_p(other)) return false
            if (count(o) != count(other)) return false
            for (const k of keys(o)) {
                if (!eq(get(o, k), get(other, k))) return false
            }
        }
        return true
    }
    if (seq_p(o)) {
        for (const a of args) {
            if(!seq_eq(o, a)) return false
        }
        return true
    }
    for (const a of args) {
        if (o !== a) return false
    }
    return true
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

// TODO: we'll need special forms for these as well so they short-circuit
// evaluation, but we also need function versions for when they are used as
// function values
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
    return false
}
self.intern("or", or)

export function not(v) {
    return falsy_p(v) ? true : false
}
self.intern("not", not)

export {gensym}
self.intern("gensym", gensym)

export function require(mod) {
    return self.resolve("*compiler*").deref().require(mod)
}
self.intern("require", require)

export async function js_import(path) {
    println("js-import", path)

    const mod = ensure_module(self.resolve("*current-package*").deref().name, `js-interop/${path}`)
    println(mod)
    // const mod = ensure_module("js", path.replace(/:/, '/'))
    if (mod.required) {
        return mod
    }
    const compiler = deref(resolve(symbol("piglet:lang:*compiler*")))
    if (compiler && path.startsWith("./") || path.startsWith("../")) {
        path=compiler.resolve_js_path(path)
    }
    const imported = await import(/* @vite-ignore */ path)
    for(const [k, v] of Object.entries(imported)) {
        mod.intern(unmunge(k), v)
    }
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

export function oget(o, k) {
    return o[k]
}
self.intern("oget", oget)

export function with_meta(o, m) {
    if (WithMeta.satisfied(o)) {
        return WithMeta._with_meta(o, m)
    }
    throw new Error(`Object ${print_str(o)} does not implement WithMeta`)
}
self.intern("with-meta", with_meta)

export function swap_$BANG$_(o, f, ...args) {
    return Swappable._swap_$BANG$_(o, f, args)
}
self.intern("swap!", swap_$BANG$_)

function postwalk(f, o) {
    o = (Walkable.satisfied(o) ? Walkable._walk(o, function (v) { return postwalk(f, v) }) : f(o))
    if (WithMeta.satisfied(o)) {
        return with_meta(o, meta(o))
    }
    return o
}
self.intern("postwalk", postwalk)

////////////////////////////////////////////////////////////////////////////////

Associative.extend(
    null,
    [function _assoc(_, k, v) { return dict(k, v)},
     function _dissoc(_, k) { return null }],

    Map,
    [function _assoc(map, k, v) {map = new Map(map); map.set(k, v); return map},
     function _dissoc(map, k) {map = new Map(map); map.delete(k); return map}],

    Array,
    [function _assoc(arr, idx, v) { return arr.map((el, i)=>i===idx?v:el)}],

    Dict,
    [function _assoc(dict, k, v) { return dict.assoc(k, v)},
     function _dissoc(dict, k) { return dict.dissoc(k)}],

    Context,
    [function _assoc(ctx, k, v) { return ctx.assoc(k, v)},
     function _dissoc(ctx, k) { return ctx.dissoc(k)}],
)

Conjable.extend(
    null,
    [function _conj(coll, el) { return cons(el, null)}],

    Array,
    [function _conj(coll, el) { coll = [...coll]; coll.push(el); return coll}],

    Map,
    [function _conj(coll, el) { coll = new Map(coll); coll.set(first(el), first(rest(el))); return coll}],

    List,
    [function _conj(coll, el) { return coll.conj(el)}],

    Dict,
    [function _conj(coll, kv) { return assoc(coll, first(kv), first(rest(kv)))}],

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
    List, [function _count(coll) { return coll.count() }],
    Dict, [function _count(coll) { return coll.count() }],
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

    Context,
    [function _keys(d) {return seq(d.keys())},
     function _vals(d) {return seq(d.values())}]
)

Eq.extend(
    null, [function _eq(self, other) { return null === other || undefined === other }],
    Number, [function _eq(self, other) { return self === other }],
    String, [function _eq(self, other) { return self === other }],
    Boolean, [function _eq(self, other) { return self === other }],

    Sym, [function _eq(self, other) { return self.eq(other) }],

    Range, [function _eq(self, other) {
        if (other instanceof Range && self.from === other.from && self.to === other.to && self.step == other.step) {
            return true
        }
        return seq_eq(self, other)
    }],

    Repeat, [function _eq(self, other) {
        if (other instanceof Repeat && self.count === other.count && self.value === other.value) {
            return true
        }
        return seq_eq(self, other)
    }],

    AbstractIdentifier, [function _eq(self, other) {
        return (other instanceof self.constructor && self.toString() == other.toString())
    }])

Lookup.extend(
    null,
    [function _get(coll, k) { return null},
     function _get(coll, k, v) { return v}],

    Dict,
    [function _get(coll, k) { return coll.get(k)},
     function _get(coll, k, v) { return coll.get(k, v)}],

    Context,
    [function _get(coll, k) { return coll.lookup(k)},
     function _get(coll, k, v) { return coll.lookup(k) || v}],

    Map,
    [function _get(coll, k) { return coll.get(k)},
     function _get(coll, k, v) { return coll.has(k) ? coll.get(k) : v}],

    Array,
    [function _get(arr, idx) { return idx in arr ? arr[idx] : null },
     function _get(arr, idx, v) { return idx in arr ? arr[idx] : v}],
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
    String, [function _repr(self) {return `"${self}"`}],
    null, [function _repr(self) {return "nil"}],
    Boolean, [function _repr(self) {return self.toString()}],
    Symbol, [function _repr(self) {return `#js:Symbol \"${self.description}\"`}],
    Array,  [function _repr(self) {return `#js ${array_str(self)}`}],
    ArrayBuffer, [function _repr(self) {return print_str(new Uint8Array(self))}],
    Uint8Array, [function _repr(self) {return `js:${self.constructor.name} ${array_str(self)}`}],
    Uint32Array, [function _repr(self) {return `js:${self.constructor.name} ${array_str(self)}`}],
    Map,  [function _repr(self) {
        return `#js:Map {${Array.from(self, ([k,v])=>[print_str(k), print_str(v)].join(" ")).join(", ")}}`
    }],
    Dict,
    [function _repr(self) {
        return `{${Array.from(self, ([k,v])=>[print_str(k), print_str(v)].join(" ")).join(", ")}}`
    }],

    QName, [function _repr(qname) {
        if (eq(Derefable.deref(self.resolve("*qname-print-style*")), keyword('compact')) ) {
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
    [(function _first(self) {return null}),
     (function _rest(self) {return null})],

    AbstractSeq,
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})]
)

Seqable.extend(
    null, [function _seq(self) {return null}],
    Array, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Map, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Dict, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    Context, [function _seq(self) {return IteratorSeq.of_iterable(self)}],
    AbstractSeq, [function _seq(self) {return self.seq()}]
)

Sequential.extend(
    Array, [],
    AbstractSeq, []
)

WithMeta.extend(
    AbstractIdentifier, [function _with_meta(identifier, metadata) {return identifier.with_meta(metadata) }],
    Dict, [function _with_meta(dict, metadata) {return dict.with_meta(metadata)}],
    Keyword, [function _with_meta(kw, metadata) {return kw.with_meta(metadata)}]
)

Walkable.extend(
    Array, [function _walk (self, f) { return Array.from(self, f) }],
    Map, [function _walk (self, f) { return new Map(Array.from(self, ([k, v])=>[f(k),f(v)])) }],
    AbstractSeq, [(function _walk (self, f) { return map(f, this) })],
    Dict, [function _walk (self, f) { return Array.from(self, ([k, v])=>[f(k),f(v)]).reduce((acc, [k, v])=>assoc(acc, k, v), dict()) }]
)

AbstractSeq.prototype[Symbol.iterator] = function() {
    return new SeqIterator(this)
}
