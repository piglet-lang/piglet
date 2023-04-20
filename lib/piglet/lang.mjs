// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./lang/Sym.mjs"
import Keyword, {keyword} from "./lang/Keyword.mjs"
import {QName, PrefixName, Context} from "./lang/QName.mjs"

import Cons from "./lang/Cons.mjs"
import Dict, {dict} from "./lang/Dict.mjs"
import IteratorSeq from "./lang/IteratorSeq.mjs"
import List from "./lang/List.mjs"
import Range from "./lang/Range.mjs"
import SeqIterator from "./lang/SeqIterator.mjs"
import LazySeq from "./lang/LazySeq.mjs"

import Var from "./lang/Var.mjs"
import Module from "./lang/Module.mjs"
import ModuleRegistry from "./lang/ModuleRegistry.mjs"

import StringReader from "./lang/StringReader.mjs"
import {meta, reset_meta} from "./lang/metadata.mjs"
import {munge, unmunge} from "./lang/util.mjs"

import Associative from "./lang/protocols/Associative.mjs"
import Conjable from "./lang/protocols/Conjable.mjs"
import DictLike from "./lang/protocols/DictLike.mjs"
import Eq from "./lang/protocols/Eq.mjs"
import Lookup from "./lang/protocols/Lookup.mjs"
import MutableCollection from "./lang/protocols/MutableCollection.mjs"
import Repr from "./lang/protocols/Repr.mjs"
import Seq from "./lang/protocols/Seq.mjs"
import Seqable from "./lang/protocols/Seqable.mjs"
import Sequential from "./lang/protocols/Sequential.mjs"
import WithMeta from "./lang/protocols/WithMeta.mjs"
import Derefable from "./lang/protocols/Derefable.mjs"

export const module_registry = new ModuleRegistry()

const self = module_registry.ensure_module("piglet", "lang")
export default self

const user = module_registry.ensure_module("localpkg", "user")
self.intern('*current-module*', user)

Associative.intern(self)
Conjable.intern(self)
DictLike.intern(self)
Eq.intern(self)
Lookup.intern(self)
MutableCollection.intern(self)
Repr.intern(self)
Seq.intern(self)
Seqable.intern(self)
Sequential.intern(self)
WithMeta.intern(self)
Derefable.intern(self)

function not_implemented() {
    throw new Error("function not available, runtime isn't loaded")
}

self.intern("*seq-print-limit*", 100)
self.intern("*compiler*", null)

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

export function cons(val, s) {
    return new Cons(val, seq(s))
}
self.intern("cons", cons)

export function satisfies_p(protocol, obj) {
    return protocol.satisfied(obj)
}
self.intern("satisfies?", satisfies_p)

export {munge, unmunge}
self.intern("munge", munge)
self.intern("unmunge", unmunge)

export function fn_p(o) {
    return typeof o === 'function'
}
self.intern("fn?", fn_p)

export function array_p(o) {
    return Array.isArray(o)
}
self.intern("array?", array_p)

export function iterator_p(o) {
    return fn_p(o.next)
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

export {dict}
self.intern("dict", dict)

export function dict_p(o) {
    return DictLike.satisfied(o)
}
self.intern("dict?", dict_p)

export function seq(o) {
    if (null === o) {
        return null
    }
    if (seq_p(o)) {
        return o
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
    return self.resolve("-first").invoke(seq(o))
}
self.intern("first", first)

export function rest(o) {
    return self.resolve("-rest").invoke(seq(o))
}
self.intern("rest", rest)

export function make_lazy_seq(thunk) {
    return new LazySeq(thunk)
}
self.intern("make-lazy-seq", make_lazy_seq)

function seq_str(s) {
    let remaining = self.resolve("*seq-print-limit*").deref()
    if (!s) {
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

export function print_str(o) {
    if (o === undefined) return "undefined"
    if (Repr.satisfied(o)) return Repr._repr(o)

    if (typeof o === 'object') {
        if(seq_p(o)) return seq_str(o)

        if (o.toString && o.toString !== {}.toString) return o.toString()

        if (o?.constructor) {
            return "#js:" + (o[Symbol.toStringTag] || o.constructor?.name) + " {" +Object.keys(o).map(k=>":"+k+" "+print_str(o[k])).join(", ") + "}"
        }
        return "#js {" + Object.keys(o).map(k=>":"+k+" "+print_str(o[k])).join(", ") + "}"
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
    return falsy_p(v) ? false : true
}
self.intern("not", not)

const gensym = (function() {
    const syms = {}
    return function gensym(str) {
        const i = (syms[str] = (syms[str] || 0) + 1)
        return symbol(`${str}-${i}`)
    }
})()
export {gensym}
self.intern("gensym", gensym)

export function require(mod) {
    return self.resolve("*compiler*").deref().require(mod)
}
self.intern("require", require)

export async function js_import(path) {
    const mod = ensure_module("js", path.replace(/:/, '/'))
    if (mod.required) {
        return mod
    }
    const imported = await import(path)
    for(const [k, v] of Object.entries(imported)) {
        mod.intern(unmunge(k), v)
    }
    mod.required = true
    return mod
}
self.intern("js-import", js_import)

export function apply(fn, ...args) {
    return fn.apply(null, args.slice(0,-1).concat(Array.from(args.slice(-1)[0])))
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

////////////////////////////////////////////////////////////////////////////////

Associative.extend(
    null,
    [function _assoc(_, k, v) { return dict(k, v)},
     function _dissoc(_, k) { return null }],

    Dict,
    [function _assoc(dict, k, v) { return dict.assoc(k, v)},
     function _dissoc(dict, k) { return dict.dissoc(k)}],

    Map,
    [function _assoc(map, k, v) {map = new Map(map); map.set(k, v); return map},
     function _dissoc(map, k) {map = new Map(map); map.delete(k); return map}],
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
     function _vals(d) {return IteratorSeq.of(d.values())}]
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
)

Lookup.extend(
    null,
    [function _get(coll, k) { return null},
     function _get(coll, k, v) { return v}],

    Dict,
    [function _get(coll, k) { return coll.get(k)},
     function _get(coll, k, v) { return coll.get(k, v)}],

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
        o[k] = v
        return o}]
)

Repr.extend(
    Number, [function _repr(self) {return self.toString()}],
    String, [function _repr(self) {return `"${self}"`}],
    null, [function _repr(self) {return "nil"}],
    Boolean, [function _repr(self) {return self.toString()}],
    Symbol, [function _repr(self) {return `#js:Symbol \"${self.description}\"`}],
    Array,  [function _repr(self) {return `#js [${self.map(e=>Repr._repr(e)).join(" ")}]`}],

    Dict,
    [function _repr(self) {
        return `{${Array.from(self, ([k,v])=>[Repr._repr(k), Repr._repr(v)].join(" ")).join(", ")}}`
    }],

    Sym, [function _repr(self) { return self.repr() }],
    Keyword, [function _repr(self) { return self.repr() }],
    Var, [function _repr(self) { return self.repr() }],
    QName, [function _repr(self) { return self.repr() }],
    PrefixName, [function _repr(self) { return self.repr() }],

    List, [function _repr(self) { return seq_str(self) }],
    Range, [function _repr(self) { return seq_str(self) }],
    Cons, [function _repr(self) { return seq_str(self) }],
    IteratorSeq, [function _repr(self) { return seq_str(self) }],
    LazySeq, [function _repr(self) { return seq_str(self) }],
)

Seq.extend(
    null,
    [(function _first(self) {return null}),
     (function _rest(self) {return null})],

    List,
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})],

    Cons,
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})],

    IteratorSeq,
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})],

    Range,
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})],

    LazySeq,
    [(function _first(self) {return self.first()}),
     (function _rest(self) {return self.rest()})],
)

Seqable.extend(
    Array, [function _seq(self) { return IteratorSeq.of_iterable(self) } ],
    Map, [function _seq(self) { return IteratorSeq.of_iterable(self) } ],
    Dict, [function _seq(self) { return IteratorSeq.of_iterable(self) } ]
)

Sequential.extend(
    Array, [],
    List, [],
    Cons, [],
    IteratorSeq, [],
    Range, [],
    LazySeq, []
)

WithMeta.extend(
    Sym, [function _with_meta(sym, metadata) {return new Sym(sym.pkg, sym.mod, sym.name, metadata)}]
)
