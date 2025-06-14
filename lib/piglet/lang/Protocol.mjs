// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {partition_n, munge, unmunge} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"

const symreg = {}
function symbol_for(str) {
  return symreg[str] ||= Symbol(str)
}

function meta_arities(o) {
  const m = meta(o)
  if (m) return m.get_kw("arities")
}

const null_proto = {}

function find_proto(o) {
  if (o === null || o === undefined) return null_proto
  if (Array.isArray()) return Array.prototype

  switch (typeof o) {
  case "object":
    return Object.getPrototypeOf(o) || Object.prototype
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
  case "string":
    return String.prototype
  }
}

function stringify_object(o) {
  if (null == o) {
    return `${o}`
  }
  if ("function" === typeof o.toJSON) {
    return `${o.toJSON()}`
  }
  if (`${o}` !== "[object Object]") {
    return `${o}`
  }
  if (Object.entries(o).length > 0) {
    return `{${
            Object.entries(o).map(([k,v])=>`${k}: ${v}`).join(", ")
        }}`
  }
  return o.toString()
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
      const arity_map = arities.reduce(
        (acc, [argv, doc])=>{
          acc[argv.length] = {
            name: method_name,
            argv: argv,
            arity: argv.length,
            doc: doc,
            sentinel: symbol_for(`${method_fullname}/${argv.length}`)}
          return acc},
        {})

      this.methods[method_name] = {
        name: method_name,
        fullname: method_fullname,
        arities: arity_map
      }
      this[munge(method_name)]=function(obj) {
        let fn
        if (fn = obj?.[arity_map[arguments.length]?.sentinel]) {
          return fn.apply(null, arguments)
        }
        if (arguments.length === 0) {
          throw new Error("Protocol method called without receiver.")
        }
        return this.invoke(arity_map, ...arguments)
      }
    }
  }

  intern(mod) {
    mod.intern(this.name, this)
    for (let {name, fullname, arities} of Object.values(this.methods)) {
      mod.intern(name, (obj, ...args)=>{
        const method = arities[args.length+1]
        if (!method) {
          throw new Error(`Wrong number of arguments to protocol ${fullname}, got ${args.length}, expected ${Object.keys(arities)}`)
        }
        const fn = (obj && obj[method.sentinel]) || find_proto(obj)[method.sentinel]
        if (!fn) {
          throw new Error(`No protocol method ${fullname} found in ${obj?.constructor?.name} ${stringify_object(obj)}`)
        }
        return fn(obj, ...args)
      }, null
                 // We use Dict instances for metadata, but we can't
                 // include Dict here... This metadata doesn't seem to be
                 // load bearing at the moment, although it would be nice
                 // to have.
                 // {"protocol-method?": true, sentinel: fullname}
                )
    }
    return this
  }

  satisfied(o) {
    if (o === null || o === undefined) {
      return !!null_proto[this.sentinel]
    }
    return !!o[this.sentinel]
  }

  method_sentinel(method_name, arity) {
    if (!this.methods[method_name]) {
      throw new Error(`No method ${method_name} in ${this.fullname}, expected ${Object.getOwnPropertyNames(this.methods)}`)
    }
    if (!this.methods[method_name].arities[arity]) {
      throw new Error(`Unknown arity for ${method_name} in ${this.fullname}, got ${arity}, expected ${Object.getOwnPropertyNames(this.methods[method_name].arities)}`)
    }
    return this.methods[method_name].arities[arity].sentinel
  }

  extend_object2(object, function_map) {
    object[this.sentinel] = true
    for (let [name_arity, fn] of Object.entries(function_map)) {
      const [method_name, arity_string] = name_arity.split("/")
      const arity = parseInt(arity_string, 10)
      object[this.method_sentinel(method_name, arity)] = fn
    }
  }

  extend2(...args) {
    for (let [klass, functions] of partition_n(2, args)) {
      const proto = klass === null ? null_proto : klass.prototype
      this.extend_object2(proto, functions)
    }
    return this
  }

  invoke(arities, obj) {
    let fn
    const arg_count = arguments.length - 1
    const method = arities[arg_count]
    if (!method) {
      throw new Error(`Wrong number of arguments to protocol method ${this.fullname}, got ${arg_count - 1}, expected ${Object.keys(arities)}`)
    }
    fn = (obj && obj[method.sentinel])
    if (!fn) {
      const proto = find_proto(obj) // for null and primitives
      if(!proto) {
        throw new Error(`${method.sentinel.description}: Failed to resolve prototype on ${obj.toString ? obj : JSON.stringify(obj)} ${typeof obj}`)
      }
      fn = proto[method.sentinel]
    }
    if (!fn) {
      throw new Error(`No protocol method ${method.name} found in ${obj?.constructor?.name} ${stringify_object(obj)}`)
    }
    return fn(obj, ...Array.prototype.slice.call(arguments, 2))
  }
}

export function extend_class(klass, ...args) {
  const proto = klass === null ? null_proto : klass.prototype
  for (let [fullname, functions] of partition_n(2, args)) {
    proto[symbol_for(fullname)] = true
    for (var fn of functions) {
      let name = unmunge(fn.name)
      let arity = fn.length
      proto[symbol_for(`${fullname}:${name}/${arity}`)] = fn
    }
  }
  return klass
}
