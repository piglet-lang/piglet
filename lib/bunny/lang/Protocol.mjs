// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import Module from "./Module.mjs"
import {partition_n} from "./util.mjs"

const registry = {}

class Protocol {
    constructor(fullname, signatures) {
        this.fullname = fullname
        this.signatures = signatures
        this.builtins = {}
        this.methods = {}
        registry[fullname] = this
    }

    satisfied(obj) {
        if (typeof obj === 'object') {
            return obj?.__protocols && obj?.__protocols[this.fullname]
        } else {
            return this.builtins[typeof obj] && this.builtins[typeof obj][this.fullname]
        }
    }
}

function munge_method_name(protocol, method_name, arity) {
    return Module.munge(protocol.fullname + "--" + method_name + "-" + arity)
}

function define_protocol(mod, name, signatures) {
    let proto = new Protocol(mod.name + "/" + name, signatures)
    mod.intern(name, proto)
    for(var signature of signatures) {
        let method_name = signature[0]
        let dispatch = function(object) {
            let arity = arguments.length
            let full_name = munge_method_name(proto, method_name, arity)
            if (object && typeof object == "object") {
                let method = object[full_name]
                if (method) {
                    return method(...arguments)
                }
            } else {
                let methods = proto.builtins[object === null ? "null" : typeof object]
                let method = methods && methods[full_name]
                if (method) {
                    return method(...arguments)
                }
            }
            throw new Error("No protocol definition for " +
                            name + " " + method_name + "/" + arity +
                            " on object " + object + (object && object.constructor ? " " + object.constructor.name : ""))
        }
        mod.intern(method_name, dispatch)
        proto.methods[method_name] = dispatch
    }
    return proto
}

function extend_protocol(protocol, type, methods) {
    if (typeof type === "string") {
        protocol.builtins[type] ||= {}
        protocol.builtins[type][protocol.fullname] = true
        for (var method of methods) {
            let name = method[0]
            let arity = method[1]
            let fn = method[2]
            let full_name = munge_method_name(protocol, name, arity)
            protocol.builtins[type][full_name] = fn
        }
    } else {
        type.prototype.__protocols ||= {}
        type.prototype.__protocols[protocol.fullname] = true
        for (var method of methods) {
            let name = method[0]
            let arity = method[1]
            let fn = method[2]
            let full_name = munge_method_name(protocol, name, arity)
            type.prototype[full_name] = fn
        }
    }
}

// These two can be used without a reference to the Protocol object, which helps
// us to bootstrap, since we can extend and invoke protocols without relying on
// bunny.lang and thus creating circular dependencies
function extend_class(klass, ...args) {
    for (let [fullname, functions] of partition_n(2, args)) {
        klass.prototype.__protocols ||= {}
        klass.prototype.__protocols[fullname] = true
        for (var fn of functions) {
            let name = Module.unmunge(fn.name)
            let arity = fn.length
            let full_name = munge_method_name({fullname: fullname}, name, arity)
            klass.prototype[full_name] = fn
        }
    }
    return klass
}

function invoke_proto(fullname, method_name, obj, ...rest) {
    return registry[fullname].methods[method_name](obj, ...rest)
}

export default Protocol
export {define_protocol, extend_protocol, extend_class, munge_method_name, invoke_proto}
