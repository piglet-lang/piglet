// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import {resolve, symbol} from "../lang.mjs"
import {meta} from "./metadata.mjs"
import {keyword} from "./Keyword.mjs"
import Sym from "./Sym.mjs"

function expression_p(node) {
    return node.type.endsWith('Expression') || node.type === 'Literal' || node.type === 'Identifier'
}

function statement_list(value) {
    if (Array.isArray(value)) {
        return value.reduce((acc,v)=>acc.concat(statement_list(v)), [])
    }
    return [expression_p(value) ? mknode('ExpressionStatement', {node: value, expression: value}) : value]
}

function wrap_last(seq, fn) {
    if (seq.length == 0) {
        return seq
    }
    const xs = seq.slice(0, -1)
    const [x] = seq.slice(-1)
    return xs.concat([fn(x)])
}

function mknode(type, {node, end_node, ...props}) {
    return {type: type,
            // start: keyword("start").call(null, meta(node)),
            // end: keyword("end").call(null, meta(end_node||node)),
            // line: keyword("line").call(null, meta(node)),
            // col: keyword("col").call(null, meta(node)),
            ...props}
}

function mksym(node, n) {
    const s = symbol(null, null, n)
    s.start = node.start
    s.end = node.end
    s.end = node.end
    s.line = node.line
    s.col = node.col
    return s
}


export default class CodeGen {
    constructor() {
    }

    emit(node, value) {
        if (value === undefined) {
            return this.emit(node, node)
        }
        if((typeof value === 'object') && (typeof (value?.emit) === "function")) {
            return value.emit(this)
        } if(Array.isArray(value)) {
            return this.array_literal(node, value.map((e)=>this.emit(node, e)))
        } else {
            return this.literal(node, value)
        }
    }

    current_module() {
        return resolve(symbol("piglet", "lang", "*current-module*")).deref()
    }

    function_expr(node, {name, argv, body}) {
        const butlast_expr = body.slice(0,-1)
        const [last_expr] = body.slice(-1)
        const return_expr = last_expr && mknode('ReturnStatement', {node: last_expr, argument: last_expr})
        return mknode('FunctionExpression',
                      {node: node,
                       id: name,
                       expression: false,
                       generator: false,
                       params: argv,
                       body: this.block_stmt(
                           node,
                           wrap_last(statement_list(body),
                                     (e)=>mknode('ReturnStatement',
                                                 {node: node,
                                                  argument: e})))})
    }

    identifier(node, name) {
        return mknode('Identifier', {node: node, name: name})
    }

    nest_expr(parts, rf) {
        return parts.slice(1).reduce(rf, parts[0])
    }

    infix_op(node, op, args) {
        return args.reduce((acc, arg)=>{
            return mknode('BinaryExpression', {node: node, end_node: arg, left: acc, operator: op, right: arg})
        })
    }

    literal(node, value, raw) {
        return mknode('Literal', {node: node, value: value, raw: raw || JSON.stringify(value)})
    }

    array_literal(node, elements) {
        return mknode('ArrayExpression', {node: node, elements: elements})
    }

    object_literal(node, kvs) {
        return mknode(
            'ObjectExpression',
            {node: node,
             properties: kvs.map((kv)=>{
                 const [k, v] = kv
                 return mknode(
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
            return mknode('MemberExpression', {node: sym, object: acc, property: this.identifier(sym, sym.name), computed: false})
        }, obj)
    }

    var_reference(node, sym) {
        const the_var = resolve(sym)
        if (!the_var) {
            throw(new Error("Var not found: " + sym.repr()))
        }
        return this.member_lookup(node,
                                  this.identifier(node, "$piglet$"),
                                  [mksym(node, Module.munge(the_var.pkg)),
                                   mksym(node, "modules"),
                                   mksym(node, Module.munge(the_var.module)),
                                   mksym(node, "vars"),
                                   mksym(node, Module.munge(sym.name)),
                                   mksym(node, "value")])
        // return this.method_call(
        //     node,
        //     "deref",
        //     this.function_call(
        //         node,
        //         this.member_lookup(node, this.identifier(node, "$piglet$"),
        //                            [mksym(node, Module.munge(the_var.pkg)),
        //                             mksym(node, "modules"),
        //                             mksym(node, Module.munge(the_var.module)),
        //                             mksym(node, "resolve")]),
        //         [this.literal(sym, sym.name)]
        //     ),
        //     []
        // )
    }

    dynamic_import(node, path) {
        return mknode('CallExpression',
                      {node: node,
                       callee: this.identifier('import'),
                       arguments: [path]})
    }

    function_call(node, callee, args) {
        return mknode('CallExpression',
                      {node: node,
                       callee: mknode('MemberExpression', {node: node,
                                                           object: callee,
                                                           property: this.identifier(node, "call"),
                                                           computed: false}),
                       arguments: [this.literal(node, null), ...args]})
    }

    method_call(node, method, object, args) {
        return mknode(
            'CallExpression',
            {node: node,
             arguments: args,
             callee: mknode('MemberExpression',
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
                                this.member_lookup(node, this.identifier(node, "$piglet$"),
                                                   [mksym(node, Module.munge(this.current_module().pkg)),
                                                    mksym(node, "modules"),
                                                    mksym(node, Module.munge(this.current_module().name))]),
                                meta ? [this.literal(name, name.name), value, meta] : [this.literal(name, name.name), value])
    }

    invoke_var(node, pkg, mod, name, args) {
        return this.method_call(
            node,
            "invoke",
            this.method_call(
                node,
                "resolve",
                this.member_lookup(node, this.identifier(node, "$piglet$"),
                                   [mksym(node, Module.munge(pkg)),
                                    mksym(node, "modules"),
                                    mksym(node, Module.munge(mod))]),
                [this.literal(node, name)]
            ),
            args
        )
    }

    conditional(node, test, if_branch, else_branch) {
        return mknode('ConditionalExpression',
                      {node:node,
                       test: test,
                       consequent: if_branch,
                       alternate: else_branch||this.literal(node, null, "null")})

    }

    await_expr(node, arg) {
        return mknode('AwaitExpression', {node:node, argument: arg})
    }

    wrap_async_iife(node, body) {
        return mknode(
            'CallExpression',
            {node: node,
             callee: mknode(
                 'FunctionExpression',
                 {node:node,
                  id: null,
                  expression: false,
                  generator: false,
                  async: true,
                  params: [],
                  body: this.block_stmt(
                      node,
                      wrap_last(statement_list(body),
                                (e)=>mknode('ReturnStatement',
                                            {node: node,
                                                   argument: mknode('AwaitExpression',
                                                                    {node: node,
                                                                     argument: e})}))
                  )}
             )}
        )
    }

    new_expr(node, ctor, args) {
        return mknode('NewExpression', {node: node, callee: ctor, arguments: args})
    }

    rest_element(node, arg) {
        return mknode('RestElement', {node:node, argument: arg})
    }

    block_stmt(node, body) {
        return mknode('BlockStatement', {node:node, body: body})
    }

    expr_stmt(node, expression) {
        return mknode('ExpressionStatement', {node:node, expression: expression})
    }

    assignment(node, left, right) {
        return mknode('AssignmentExpression',
                      {node:node,
                       operator: '=',
                       left: left,
                       right: right})

    }

    variable_decl(node, identifier, rhs) {
        return mknode('VariableDeclaration',
                      {node: node,
                       kind: 'const',
                       declarations: [mknode('VariableDeclarator', {node: node, id: identifier, init: rhs})]})
    }

    lhs(node, form) {
        if (Array.isArray(form)) {
            return mknode('ArrayPattern', {node: node,
                                           elements: form.map((e)=>this.lhs(node, e))})
        } else  {
            return this.emit(form)
        }
    }
}
