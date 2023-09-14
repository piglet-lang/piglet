// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import {resolve, symbol, module_registry, qsym} from "../lang.mjs"
import {meta} from "./metadata.mjs"
import {keyword} from "./Keyword.mjs"
import Sym from "./Sym.mjs"
import {assert, munge, partition_n_step} from "./util.mjs"
import Lookup from "./protocols/Lookup.mjs"

function expression_p(node) {
    return node.type.endsWith('Expression') ||
        node.type === 'Literal' ||
        node.type === 'Identifier'
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

const kw_start = keyword("start")
const kw_end = keyword("end")
const kw_line = keyword("line")
const kw_col = keyword("col")

function mknode(type, {node, end_node, ...props}) {
    const out = {type: type, ...props}
    // TODO: adding these locations incurs a significant cost, and is really
    // only useful for source mapping. We should disable this if source mapping
    // is off. Also see: mksym
    const m = meta(node)
    if (m) {
        const start = Lookup._get(m, kw_start)
        const end = Lookup._get(m, kw_end)
        const line = Lookup._get(m, kw_line)
        const col = Lookup._get(m, kw_col)
        if (start) out.start = start
        if (end) out.end = end
        if (line) out.line = line
        if (col) out.col = col
    }
    if (out.start) {
        out.loc = {start: {line: out.line, column: out.col}}
    }
    return out
}

const NULL_NODE = mknode('Literal', {value: null, raw: 'null'})
const global = typeof window === 'undefined' ? 'global' : 'window'

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
        assert(arguments.length == 2, "Emit takes a node and a value")
        if (value === null) {
            return NULL_NODE
        }
        if(Array.isArray(value)) {
            return this.array_literal(node, value.map((e)=>this.emit(node, e)))
            // return this.wrap_set_meta(
            //     this.array_literal(node, value.map((e)=>this.emit(node, e))),
            //     meta(value)
            // )
        }
        if((typeof value === 'object' || typeof value === 'function') && (typeof (value?.emit) === "function")) {
            return value.emit(this)
        }
        if (value instanceof RegExp) {
            return mknode("Literal", {node: value, value: {}, raw: value.toString(), regex: {pattern: value.source, modifiers: value.modifiers}})
        }
        if(typeof value === 'object') {
            return this.object_literal(node, Object.entries(value).map(([k,v])=>[this.emit(node, k), this.emit(node, v)]))
        }
        // if(value === undefined) {
        //     console.error("NODE", node)
        //     throw new Error(`Can't emit undefined`)
        // }
        return this.literal(node, value)
    }

    emit_expr(node, value) {
        return this.as_expression(this.emit(node, value))
    }

    current_module() {
        return resolve(symbol("piglet:lang:*current-module*")).deref()
    }

    as_expression(node) {
        if (Array.isArray(node)) {
            if (node.find(Array.isArray)) {
                node = node.flat()
            }
            if (node.length == 0) {
                return NULL_NODE
            }
            if (node.length == 1) {
                return this.as_expression(node[0])
            }
            if (expression_p(node.slice(-1)[0])) {
                return this.wrap_iife(node[0], node)
            } else {
                return this.wrap_iife(node[0], node.concat([NULL_NODE]))
            }
        }
        if (expression_p(node)) {
            return node
        }
        if (node.type === 'ExpressionStatement') {
            return node.expression
        }
        return this.wrap_iife(node, [node, NULL_NODE])
    }

    as_statement(node) {
        if (Array.isArray(node)) {
            if (node.find(Array.isArray)) {
                node = node.flat()
            }
            if (node.length == 0) {
                return mknode('EmptyStatement', {})
            }
            if (node.length == 1) {
                return this.as_statement(node[0])
            }
            return this.block_stmt(node[0], node)
        }
        if (!expression_p(node)) {
            return node
        }
        return this.expr_stmt(node, node)
    }

    function_body(node, body) {
        return this.block_stmt(
            node,
            wrap_last(statement_list(body),
                      (e)=>{return e.type === 'ThrowStatement' ? e :
                            mknode('ReturnStatement',
                                   {node: node,
                                    argument: this.as_expression(e)})}))
    }

    wrap_set_meta(node, meta) {
        if (meta) {
            return this.invoke_var(
                node,
                'piglet',
                'lang',
                'set-meta!',
                [node, this.emit(meta, meta)])
        }
        return node
    }

    function_expr(node, {name, argv, body, async_p, meta}) {
        return this.wrap_set_meta(
            mknode('FunctionExpression',
                   {node: node,
                    id: name,
                    expression: false,
                    generator: false,
                    params: argv,
                    async: async_p,
                    body: this.function_body(node, body)}),
            meta)
    }

    identifier(node, name) {
        return mknode('Identifier', {node: node, name: name})
    }

    nest_expr(parts, rf) {
        return parts.slice(1).reduce(rf, parts[0])
    }

    infix_op(node, op, args) {
        return args.reduce((acc, arg)=>{
            return mknode('BinaryExpression', {
                node: node,
                end_node: arg,
                left: this.as_expression(acc),
                operator: op,
                right: this.as_expression(arg)
            })
        })
    }

    boolean_infix_op(node, op, args) {
        return partition_n_step(2, 1, args).map(([left, right])=>{
            return mknode('BinaryExpression', {
                node: node,
                end_node: right,
                left: this.as_expression(left),
                operator: op,
                right: this.as_expression(right)
            })
        }).reduce((acc, arg)=>{
            return mknode('BinaryExpression', {
                node: node,
                end_node: arg,
                left: this.as_expression(acc),
                operator: op,
                right: this.as_expression(arg)
            })
        })
    }

    literal(node, value, raw) {
        return mknode('Literal',
                      {node: node,
                       value: value,
                       raw: (raw === undefined && value === undefined ? "undefined" :
                             typeof value === "bigint" ? value.toString() + "n" :
                             JSON.stringify(value))})
    }

    array_literal(node, elements) {
        return mknode('ArrayExpression', {node: node, elements: elements.map((e)=>this.as_expression(e))})
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
                      key: k,
                      value: v})})})
    }

    member_lookup(node, obj, syms) {
        return syms.reduce((acc,sym)=>{
            return mknode('MemberExpression', {node: sym, object: this.as_expression(acc), property: this.identifier(sym, sym.name), computed: false})
        }, obj)
    }

    oget(node, o, k) {
        return mknode('MemberExpression', {node: node, object: this.as_expression(o), property: k, computed: true})
    }

    var_value(node, sym) {
        return this.member_lookup(node, this.var_ref(node, sym), [symbol('value')])
    }

    var_ref(node, sym) {
        const the_var = resolve(sym)
        if (!the_var) {
            throw(new Error(`Var not found: ${sym.inspect()} in ${this.current_module().inspect()}`))
        }
        assert(the_var.pkg)
        // if (the_var.global_name) {
        //     return mknode('MemberExpression',
        //                   {node: node,
        //                    object: this.identifier(node, global),
        //                    property: this.identifier(node, the_var.global_name),
        //                    computed: false})
        // }
        return this.member_lookup(node,
                                  this.oget(node,
                                            this.identifier(node, "$piglet$"),
                                            this.literal(node, the_var.pkg, `"${the_var.pkg}"`)),
                                  [mksym(node, munge(the_var.module)),
                                   mksym(node, munge(sym.name))])
        // return this.method_call(
        //     node,
        //     "deref",
        //     this.function_call(
        //         node,
        //         this.member_lookup(node, this.identifier(node, "$piglet$"),
        //                            [mksym(node, munge(the_var.pkg)),
        //                             mksym(node, "modules"),
        //                             mksym(node, munge(the_var.module)),
        //                             mksym(node, "resolve")]),
        //         [this.literal(sym, sym.name)]
        //     ),
        //     []
        // )
    }

    call_expr(node, callee, args) {
        return mknode('CallExpression',
                      {node: node,
                       callee: callee,
                       arguments: args})

    }

    dynamic_import(node, path) {
        return this.call_expr(node, this.identifier('import'), [path])
    }

    function_call(node, callee, args) {
        return this.call_expr(node, this.as_expression(callee), args.map((a)=>this.as_expression(a)))
    }

    method_call(node, method, object, args) {
        return this.call_expr(
            node,
            mknode('MemberExpression',
                   {node: node,
                    object: object,
                    property: (typeof method === 'string' ?
                               this.identifier(node, method) :
                               this.identifier(method, method.name)),
                    computed: false}),
            args.map((a)=>this.as_expression(a))
        )
    }

    define_var(node, name, value, meta) {
        return this.function_call(node,
                                  this.var_ref(node, symbol('piglet:lang:intern')),
                                  meta ? [this.emit(node, name), value, meta] : [this.emit(name, name), value])
        // return this.method_call(node,
        //                         "intern",
        //                         this.module_ref(node, this.current_module().pkg, this.current_module().name),
        //                         meta ? [this.literal(name, name.name), value, meta] : [this.literal(name, name.name), value])
    }

    invoke_var(node, pkg, mod, name, args) {
        return this.function_call(
            node,
            this.var_ref(node, symbol(pkg, mod, name)),
            args
        )
    }

    conditional(node, test, if_branch, else_branch) {
        return mknode('ConditionalExpression',
                      {node:node,
                       test: this.as_expression(test),
                       consequent: this.as_expression(if_branch),
                       alternate: this.as_expression(else_branch||NULL_NODE)})

    }

    await_expr(node, arg) {
        return mknode('AwaitExpression', {node:node, argument: arg})
    }

    wrap_iife(node, body) {
        return this.call_expr(
            node,
            this.function_expr(node, {name: null, argv: [], body: body, async_p: false}),
            []
        )
    }

    wrap_async_iife(node, body) {
        return this.call_expr(
            node,
            this.function_expr(node, {name: null, argv: [], body: body, async_p: true}),
            []
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
                       right: this.as_expression(right)})

    }

    var_decl(node, kind, identifier, rhs) {
        return mknode('VariableDeclaration',
                      {node: node,
                       kind: kind,
                       declarations: [mknode('VariableDeclarator', {node: node, id: identifier, init: this.as_expression(rhs)})]})
    }

    const_var_decl(node, identifier, rhs) { return this.var_decl(node, 'const', identifier, rhs) }
    let_var_decl(node, identifier, rhs)   { return this.var_decl(node, 'let', identifier, rhs) }

    lhs(node, form) {
        if (Array.isArray(form)) {
            return mknode('ArrayPattern', {node: node,
                                           elements: form.map((e)=>this.lhs(node, e))})
        } else  {
            return this.emit(node, form)
        }
    }

    unary_expression(node, operator, argument, prefix) {
        return mknode('UnaryExpression',
                      {node: node,
                       operator: operator,
                       argument: this.as_expression(argument),
                       prefix: prefix})
    }

    typeof_expression(node, argument) {
        return this.unary_expression(node, "typeof", argument, true)
    }

    throw_stmt(node, argument) {
        return mknode('ThrowStatement', {node:node, argument:argument})
    }

    while_stmt(node, test, body) {
        return mknode('WhileStatement',
                      {node: node,
                       test: test,
                       body: this.as_statement(body)})
    }

    catch_clause(catch_form, arg, body) {
        return mknode('CatchClause',
                      {node: catch_form,
                       param: this.emit(arg, arg),
                       body: this.block_stmt(catch_form, statement_list(body.map(f=>this.emit(f, f))))})
    }

    try_stmt(form, body,
             catch_form, catch_arg, catch_body,
             finalizer_form, finalizer_body) {
        return mknode('TryStatement',
                      {node: form,
                       block: this.block_stmt(form, statement_list(body.map(f=>this.emit(f, f)))),
                       handler: catch_form && this.catch_clause(catch_form, catch_arg, catch_body),
                       finalizer: finalizer_form && this.block_stmt(finalizer_form, statement_list(finalizer_body.map(f=>this.emit(f, f))))})
    }

    break_stmt() { return {type: 'BreakStatement'} }
    continue_stmt() { return {type: 'ContinueStatement'} }
}
