// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import {resolve, symbol} from "../lang.mjs"

export default class CodeGen {
    constructor() {
    }

    emit(node, value) {
        if((typeof value === 'object') && (typeof (value?.emit) === "function")) {
            return value.emit(this)
        } else {
            return this.literal(node, value)
        }
    }

    mknode(type, {node, end_node, ...props}) {
        return {type: type,
                start: node?.start,
                end: (end_node||node)?.end,
                line: node?.line,
                col: node?.col,
                ...props}
    }

    mksym(node, n) {
        const s = symbol(null, n)
        s.start = node.start
        s.end = node.end
        s.end = node.end
        s.line = node.line
        s.col = node.col
        return s
    }

    current_module() {
        return resolve(symbol("bunny:lang", "*current-module*")).deref()
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

    array_literal(node, elements) {
        return this.mknode('ArrayExpression', {node: node, elements: elements})
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

    member_lookup(node, obj, syms) {
        return syms.reduce((acc,sym)=>{
            return this.mknode('MemberExpression', {node: sym, object: acc, property: this.identifier(sym, sym.name), computed: false})
        }, obj)
    }

    var_reference(node, sym) {
        const the_var = resolve(sym)
        if (!the_var) {
            throw(new Error("Var not found: " + sym.repr()))
        }
        //return this.member_lookup(node, [this.mksym(node, "$bunny$"), this.mksym(node, Module.munge(mod_name)), this.mksym(node, "vars"), this.mksym(node, Module.munge(sym.name)), this.mksym(node, "value")])
        return this.method_call(
            node,
            "deref",
            this.function_call(
                node,
                this.member_lookup(node, this.identifier(node, "$bunny$"), [this.mksym(node, Module.munge(the_var.module)), this.mksym(node, "resolve")]),
                [this.literal(sym, sym.name)]
            ),
            []
        )
    }

    method_call(node, method, object, args) {
        return this.mknode(
            'CallExpression',
            {node: node,
             arguments: args,
             callee: this.mknode('MemberExpression',
                                 {node: node,
                                  object: object,
                                  property: (typeof method === 'string' ?
                                             this.identifier(node, method) :
                                             this.identifier(method, method.name)),
                                  computed: false})})
    }

    define_var(node, name, value, meta) {
        return this.method_call(node,
                                "intern",
                                this.member_lookup(node, this.identifier(node, "$bunny$"), [this.mksym(node, Module.munge(this.current_module().name))]),
                                meta ? [this.literal(name, name.name), value, meta] : [this.literal(name, name.name), value])
    }

    invoke_var(node, ns, name, args) {
        return this.method_call(
            node,
            "invoke",
            this.method_call(
                node,
                "resolve",
                this.member_lookup(node, this.identifier(node, "$bunny$"), [this.mksym(node, Module.munge(ns))]),
                [this.literal(node, name)]
            ),
            args
        )
    }

    conditional(node, test, if_branch, else_branch) {
        return this.mknode('ConditionalExpression',
                           {node:node,
                            test: test,
                            consequent: if_branch,
                            alternate: else_branch||this.literal(node, null, "null")})

    }

    await_expr(node, arg) {
        return this.mknode('AwaitExpression', {node:node, argument: arg})
    }

    wrap_async_iife(node, body) {
        return this.mknode(
            'CallExpression',
            {node: node,
             callee: this.mknode(
                 'FunctionExpression',
                 {node:node,
                  id: null,
                  expression: false,
                  generator: false,
                  async: true,
                  params: [],
                  body: this.mknode(
                      'BlockStatement',
                      {node: node,
                       body: [this.mknode('ReturnStatement',
                                          {node: node,
                                           argument: this.mknode('AwaitExpression',
                                                                 {node: node,
                                                                  argument: body})})]}
                  )}
             )}
        )
    }
}
