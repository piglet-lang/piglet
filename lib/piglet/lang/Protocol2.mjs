// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import Module from "./Module.mjs"
import {partition_n} from "./util.mjs"
import {dict} from "./Dict.mjs"
import {keyword} from "./Keyword.mjs"
import {set_meta} from "./metadata.mjs"

const symreg = {}
function symbol_for(str) {
    return symreg[str] ||= Symbol(str)
}

const null_proto = {}

function find_proto(o) {
    if (o === null || o === undefined) return null_proto
    if (Array.isArray()) return Array.prototype

    switch (typeof o) {
    case "object":
        return Object.getPrototypeOf(o)
    case "boolean":
        return Boolean.prototype
    case "number":
        return Number.prototype
    case "bigint":
        return BigInt.prototype
    case "symbol":
        return Symbol.prototype
    case "function":
        return Function.prototype
    }
}

export default class Protocol {
    constructor(meta, module_name, proto_name, signatures) {
        this.fullname = `${module_name}:${proto_name}`
        this.sentinel = symbol_for(this.fullname)

        set_meta(this, meta)
        this.module_name = module_name
        this.name = proto_name
        this.methods = {}

        for(let signature of signatures) {
            const [method_name, arities] = signature
            const method_fullname = `${module_name}:${proto_name}:${method_name}`
            this.methods[method_name] = {
                name: method_name,
                fullname: method_fullname,
                arities: arities.reduce(
                    (acc, [argv, doc])=>{
                        acc[argv.length] = {
                            argv: argv,
                            arity: argv.length,
                            doc: doc,
                            sentinel: symbol_for(`${method_fullname}/${argv.length}`)}
                        return acc},
                    {})
            }
        }
    }

    intern(mod) {
        mod.intern(this.name, this)
        for (let {name, fullname, arities} of Object.values(this.methods)) {
            mod.intern(name, (obj, ...args)=>{
                const method = arities[args.length+1]
                if (!method) {
                    throw new Error(`Wrong number of arguments to protocol, got ${args.length}, expected ${Object.keys(arities)}`)
                }
                const fn = find_proto(obj)[method.sentinel]
                if (!fn) {
                    throw new Error(`No protocol method ${fullname} found in ${obj} ${obj?.constructor?.name}`)
                }
                return fn(obj, ...args)
            }, dict(keyword("protocol-method?"), true,
                    keyword("sentinel"), fullname))
        }
    }

    satisfied(o) {
        return !!o[this.sentinel]
    }

    extend(...args) {
        for (let [klass, functions] of partition_n(2, args)) {
            const proto = klass === null ? null_proto : klass.prototype
            proto[this.sentinel] = true
            for (var fn of functions) {
                let method_name = Module.unmunge(fn.name)
                let arity = fn.length
                proto[this.methods[method_name].arities[arity].sentinel] = fn
            }
        }
    }

    // invoke(method_name, obj, ...args) {
    //     const arities = this.methods[method_name]
    //     if (!arities) {
    //         throw new Error(`No method ${method_name} in protocol ${this.fullname}`)
    //     }
    //     const method = arities[args.length + 1]
    //     if (!method) {
    //         throw new Error(`Wrong number of arguments to protocol, got ${args.length}, expected ${Object.keys(arities)}`)
    //     }
    //     const fn = find_proto(obj)[method.sentinel]
    //     if (!fn) {
    //         throw new Error(`No protocol method ${fullname} found in ${obj} ${obj?.constructor?.name}`)
    //     }
    //     return fn(obj, ...args)
    // }
}

export function extend_class(klass, ...args) {
    const proto = klass === null ? null_proto : klass.prototype
    for (let [fullname, functions] of partition_n(2, args)) {
        proto[symbol_for(fullname)] = true
        for (var fn of functions) {
            let name = Module.unmunge(fn.name)
            let arity = fn.length
            proto[symbol_for(`${fullname}:${name}/${arity}`)] = fn
        }
    }
    return klass
}

export function invoke_proto(fullname, method_name, obj, ...args) {
    const arity = args.length + 1
    const sentinel = symbol_for(`${fullname}:${method_name}/${arity}`)
    if (!sentinel in obj) {
        if (obj[symbol_for(fullname)]) {
            throw new Error(`Wrong arity for protocol method ${fullname}:${method_name} on ${obj.toString()}`)
        }
        throw new Error(`Protocol ${fullname} not implemented on ${obj.toString()}`)
    }
    return obj[sentinel](obj, ...args)
}

export function satisfied(fullname, obj) {
    return !!obj[symbol_for(fullname)]
}
