// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import {resolve, symbol} from "../lang.mjs"

export default class CodeGen {
    constructor() {
    }

    mknode(type, {node, end_node, ...props}) {
        return {type: type,
                start: node?.start,
                end: (end_node||node)?.end,
                line: node?.line,
                col: node?.col,
                ...props}
    }

    current_module() {
        return resolve(symbol("bunny.lang", "*current-module*")).deref()
    }

    function_expr(node, {name, argv, body}) {
        const butlast_expr = body.slice(0,-1)
        const [last_expr] = body.slice(-1)
        const return_expr = last_expr && this.mknode('ReturnStatement', {node: last_expr, argument: last_expr})
        return this.mknode('FunctionExpression',
                           {node: node,
                            id: name,
                            expression: false,
                            generator: false,
                            params: argv,
                            body: this.mknode('BlockStatement',
                                              {node: body[0],
                                               end_node: last_expr,
                                               body: butlast_expr.concat(return_expr && [return_expr])})})
    }

    identifier(node, name) {
        return this.mknode('Identifier', {node: node, name: name})
    }

    nest_expr(parts, rf) {
        return parts.slice(1).reduce(rf, parts[0])
    }

    infix_op(node, op, args) {
        return args.reduce((acc, arg)=>{
            return this.mknode('BinaryExpression', {node: node, end_node: arg, left: acc, operator: op, right: arg})
        })
    }

    function_call(node, callee, args) {
        return this.mknode('CallExpression',
                           {node: node,
                            callee: callee,
                            arguments: args})
    }

    literal(node, value, raw) {
        return this.mknode('Literal', {node: node, value: value, raw: raw || JSON.stringify(value)})
    }

    object_literal(node, kvs) {
        return this.mknode(
            'ObjectExpression',
            {node: node,
             properties: kvs.map((kv)=>{
                 const [k, v] = kv
                 return this.mknode(
                     'Property',
                     {node: node,
                      method: false,
                      shorthand: false,
                      computed: false,
                      kind: "init",
                      key: this.literal(node, k),
                      value: v}
                 )})}
        )
    }



    member_lookup(node, syms) {
        return syms.slice(1).reduce((acc,sym)=>{
            return this.mknode('MemberExpression', {node: sym, object: acc, property: this.identifier(sym, sym.name), computed: false})
        }, this.identifier(syms[0], syms[0].name))
    }

    var_reference(node, sym) {
        let mod_name = this.current_module().name
        if (sym.namespaced()) {
            mod_name = this.current_module().aliases[sym.namespace] || sym.namespace
        }
        if (!resolve(symbol(mod_name, sym.name))) {
            throw(new Error("Var not found: " + mod_name + "/" + sym.name))
        }
        const mksym = n=>{
            const s = symbol(null, n)
            s.start = node.start
            s.end = node.end
            s.end = node.end
            s.line = node.line
            s.col = node.col
            return s
        }
        return this.member_lookup(node, [mksym("$bunny$"), mksym(Module.munge(mod_name)), mksym("vars"), mksym(Module.munge(sym.name)), mksym("value")])
    }

    method_call(node, method, object, args) {
        return this.mknode(
            'CallExpression',
            {node: node,
             arguments: args,
             callee: this.mknode('MemberExpression',
                                 {node: node,
                                  object: object,
                                  property: this.identifier(method, method),
                                  computed: false})})
    }

    define_var(node, name, value, meta) {
        const mksym = n=>{
            const s = symbol(null, n)
            s.start = node.start
            s.end = node.end
            s.end = node.end
            s.line = node.line
            s.col = node.col
            return s
        }
        return this.method_call(node,
                                mksym("intern"),
                                this.member_lookup(node, [mksym("$bunny$"), mksym(Module.munge(this.current_module().name))]),
                                meta ? [this.literal(name, name.name), value, meta] : [this.literal(name, name.name), value])
    }

    conditional(node, test, if_branch, else_branch) {
        return this.mknode('ConditionalExpression',
                           {test: test,
                            consequent: if_branch,
                            alternate: else_branch||this.literal(node, null, "null")})

    }

}
