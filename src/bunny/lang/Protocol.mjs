// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import {GLOBAL_SCOPE, CURRENT_MODULE, resolve, get_module} from "./runtime.mjs"

class Protocol {
    constructor(name, signatures) {
        this.name = name
        this.signatures = signatures
        this.builtins = {}
    }
}

function define_protocol(name, signatures) {
    let mod = get_module(name.namespace)
    let proto = new Protocol(name, signatures)
    mod.intern(name, proto)
    for(var signature of signatures) {
        let method_name = signature[0]
        mod.intern(method_name, function(object) {
            let arity = arguments.length
            let full_name = munge_method_name(proto, method_name, arity)
            if (typeof object == "object") {
                let method = object[full_name]
                if (method) {
                    return method.apply(null, arguments)
                }
            } else {
                let methods = proto.builtins[typeof object]
                let method = methods && methods[full_name]
                if (method) {
                    return method.apply(null, arguments)
                }
            }
            throw new Error("No protocol definition for " + name + " " + method_name + "/" + arity + " on object " + object)
        })
    }
    return proto
}

function munge_method_name(protocol, method_name, arity) {
    return protocol.name.toString() + "$$" + method_name + "$$" + arity;
}

function extend_protocol(protocol, type, methods) {
    for (var method of methods) {
        let name = method[0]
        let arity = method[1]
        let fn = method[2]
        let full_name = munge_method_name(protocol, name, arity)
        if (typeof type === "string") {
            protocol.builtins[type] ||= {}
            protocol.builtins[type][full_name] = fn
        } else {
            type.prototype[full_name] = fn
        }
    }
}

export default Protocol
export {define_protocol, extend_protocol, munge_method_name}
