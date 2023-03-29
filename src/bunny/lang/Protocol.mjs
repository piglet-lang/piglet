// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"

class Protocol {
    constructor(fullname, signatures) {
        this.fullname = fullname
        this.signatures = signatures
        this.builtins = {}
        this.methods = {}
    }

    satisfied(obj) {
        if (typeof obj === 'object') {
            return obj?.__protocols[this.fullname]
        } else {
            return this.builtins[typeof obj][this.fullname]
        }
    }
}

function munge_method_name(protocol, method_name, arity) {
    return protocol.fullname + "$$" + method_name + "$$" + arity;
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
            console.dir(object.__proto__, {depth: null})
            throw new Error("No protocol definition for " + name + " " + method_name + "/" + arity + " on object " + object)
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

export default Protocol
export {define_protocol, extend_protocol, munge_method_name}
