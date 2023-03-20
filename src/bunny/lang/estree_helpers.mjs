// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {GLOBAL_SCOPE, CURRENT_MODULE} from "./runtime.mjs"

function member_lookup(syms) {
    return syms.reduce((acc,id)=>{
        return {type: 'MemberExpression',
                start: acc.start,
                end: id.end,
                object: acc,
                property: id,
                computed: false}
    })
}

function string_literal(s) {
    return {type: "Literal", value: s, raw: JSON.stringify(s)}
}

function identifier(i) {
    return {type: "Identifier", name: i}
}

function global_lookup(elements) {
    return elements.reduce(
        (acc,el)=>{
            return {
                type: 'MemberExpression',
                object: acc,
                property: (el.type ? el : {type: "Identifier", name: el.name}),
                computed: el.computed || false
            }
        },
        {type: "Identifier", name: GLOBAL_SCOPE.deref()},)
}

function method_call(callee, method, args) {
    return {type: "CallExpression",
            callee: {type: "MemberExpression",
                     object: callee,
                     property: identifier(method)},
            arguments: args}
}

function module_lookup(module_name) {
    return {type: "MemberExpression",
            object: global_lookup([{name: "bunny"}, {name: "modules"}]),
            property: string_literal(module_name),
            computed: true}
}

function var_lookup(module_name, var_name) {
    return method_call(
        method_call(module_lookup(module_name),
                    "get_var",
                    [string_literal(var_name)]),
        "deref",
        [])
}

export {member_lookup, string_literal, identifier, global_lookup, method_call, module_lookup, var_lookup}
