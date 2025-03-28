// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Module from "./Module.mjs"
import {resolve, symbol, module_registry, find_module, qsym, print_str, gensym} from "../lang.mjs"
import {meta} from "./metadata.mjs"
import {keyword} from "./Keyword.mjs"
import Sym from "./Sym.mjs"
import {assert, munge, partition_n_step} from "./util.mjs"
import Lookup from "./protocols/Lookup.mjs"

function expression_p(node) {
    return node.type.endsWith('Expression') ||
        node.type === 'Literal' ||
        node.type === 'Identifier' ||
        node.type === 'Program' // see [[ASTRING_COMMENT_HACK]]
}

function statement_p(node) {
    return node.type !== 'ExpressionStatement' && !expression_p(node)
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
const kw_file = keyword("file")

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
        // if (start) out.start = start
        // if (end) out.end = end
        // if (line) out.line = line
        // if (col) out.col = col
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
    constructor(flags) {
        this.flags = Object.assign({
            export_vars: false, // when declaring a var, emit a `export const <var-name> = /*@__PURE__*/(iife which creates the var)`
            track_var_use: false, // track on the module level which vars from other modules are used and should be imported
            import_vars: false, // reference vars directly by an imported name
        }, flags)
    }

    emit(node, value) {
        try {
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
            if(typeof value === 'symbol') {
                return this.method_call(
                    node,
                    'for',
                    this.identifier(node, 'Symbol'),
                    [this.literal(node, value.description, value.description)])
            }
            // if(value === undefined) {
            //     console.error("NODE", node)
            //     throw new Error(`Can't emit undefined`)
            // }
            return this.literal(node, value)
        } catch (e) {
            if (!e.message.startsWith("Piglet compilation failed")) {
                const m = meta(node)
                e.message = `Piglet compilation failed at\n  ${Lookup._get(m, kw_file)}:${Lookup._get(m, kw_line)}:${Lookup._get(m, kw_col)}\n  ${print_str(node.form)}\n\n${e.message}`
            }
            throw e
        }
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

    return_stmt(node, expression) {
        return mknode('ReturnStatement',
                      {node: node,
                       argument: this.as_expression(expression)})
    }

    function_body(node, body) {
        return this.block_stmt(
            node,
            wrap_last(statement_list(body), (e)=>(statement_p(e) ? e : this.return_stmt(e, e))))
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

    member_expr(node, o, k, computed) {
        return mknode('MemberExpression', {node: node, object: this.as_expression(o), property: k, computed: computed})
    }

    var_value(node, sym) {
        const the_var = resolve(sym)
        if (this.flags.import_vars && Lookup._get(meta(the_var), keyword("link-direct"))) {
            console.log("DIRECT", the_var.fqn)
            return this.var_ref(node, sym)
        }
        return this.member_lookup(node, this.var_ref(node, sym), [symbol('value')])
    }

    var_ref(node, sym) {
        const the_var = resolve(sym)
        if (!the_var) {
            throw(new Error(`Var not found: ${sym.inspect()} in ${this.current_module().inspect()}`))
        }
        const cur_mod = this.current_module()
        const var_mod = find_module(the_var.pkg, the_var.module)
        const same_mod = var_mod == cur_mod
        if (same_mod && this.flags.import_vars) {
            return this.identifier(node, the_var.js_name)
        }
        let var_sym = null
        if (!same_mod && this.flags.track_var_use) {
            cur_mod.used_imported_vars ||= Object.create(null)
            assert(var_mod.fqn)
            cur_mod.used_imported_vars[var_mod.fqn] ||= Object.create(null)
            var_sym = cur_mod.used_imported_vars[var_mod.fqn][the_var.js_name] ||= gensym(the_var.js_name)
        }
        if (this.flags.import_vars) {
            assert(var_sym, "codegen.flags.import_vars requires codegen.flags.track_var_use")
            return this.identifier(node, var_sym.name)
        }
        return this.member_lookup(node,
                                  this.oget(node,
                                            this.identifier(node, "$piglet$"),
                                            this.literal(node, the_var.pkg, `"${the_var.pkg}"`)),
                                  [mksym(node, munge(the_var.module)),
                                   mksym(node, munge(sym.name))])
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
        const fn = this.function_call(node,
                                      this.var_ref(node, symbol('piglet:lang:intern')),
                                      meta ? [this.emit(node, name), value, meta] : [this.emit(name, name), value])
        if (this.flags.export_vars) {
            const iife = this.wrap_iife(node, fn)
            const identifier = this.identifier(name, resolve(name).js_name)
            /* [[ASTRING_COMMENT_HACK]]
             * https://github.com/davidbonnet/astring/issues/671
             *
             * Astring only emits comments when they are on a direct child of a
             * Program, BlockStatement, or ClassBody node, so we have to wrap an
             * extra 'Program' around the IIFE for the @__PURE__ comment to be
             * rendered, even though that makes no sense. Luckily 'Program' just
             * renders its children in order and emits no other tokens, so this
             * works fine, but other tools might balk at the EStree AST we
             * generate here. We also had to muck up our own `expression_p` to
             * consider 'Program' an expression, or we'd get extra IIFE
             * wrapping. Luckily this is currently the only place we use
             * 'Program'.
             *
             * We might want to consider forking/vendoring AStree, or writing
             * our own ESTree -> JS transform so we can address these sort of
             * things.
             */
            iife.comments = [{type: "Block", value: " @__PURE__ "}]
            const decl = this.const_var_decl(node, identifier, mknode('Program', {node: node, body: [iife]}))
            const export_decl = mknode('ExportNamedDeclaration',
                                       {node: node,
                                        declaration: decl,
                                        specifiers: []})
            return export_decl
        }
        return fn
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

    if_stmt(node, test, if_branch, else_branch) {
        return mknode('IfStatement',
                      {node:node,
                       test: this.as_expression(test),
                       consequent: this.block_stmt(if_branch, if_branch),
                       alternate: this.block_stmt(else_branch, else_branch||NULL_NODE)})

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
        return mknode('BlockStatement', {node:node, body: statement_list(body)})
    }

    static_block(node, body) {
        return mknode('StaticBlock', {node:node, body: statement_list(body)})
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
                       body: this.block_stmt(body, statement_list(body))})
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

    class_declaration(...args) {
        let node = this.class_expr(...args)
        node.type = 'ClassDeclaration'
        return node
    }

    class_expr(identifier, superclass, methods) {
        let node = mknode('ClassExpression',
                          {node: identifier,
                           id: identifier,
                           body: {type: 'ClassBody', body: methods}})
        if (superclass)
            node.superClass = superclass
        return node
    }

    class_method(kind, key, value, computed, is_static) {
        // kind: "constructor" | "method" | "get" | "set";
        return mknode('MethodDefinition',
                      {node: key,
                       kind: kind,
                       key: key,
                       value: value,
                       computed: computed,
                       static: is_static})
    }

    class_field(key, value, computed, is_static) {
        let props = {node: key,
                     key: key,
                     computed: computed,
                     static: is_static}
        if (value !== undefined) {
            props.value = value
        }
        return mknode('PropertyDefinition', props)
    }

    module_imports(mod) {
        return Object.keys(mod.used_imported_vars || {}).map(
            (from_mod)=>{
                const dots = mod.fqn.toString().replace(/[a-z-]+:\/+/, '').split(/\//).slice(1).map((_)=>"../").join("")
                const mod_path = `${dots}${from_mod.replace(/[a-z-]+:\/+/, '')}.mjs`
                return mknode('ImportDeclaration', {
                    source: this.literal(null, mod_path, mod_path),
                    specifiers: Object.keys(mod.used_imported_vars[from_mod]).map((from_var)=>mknode('ImportSpecifier', {
                        imported: this.identifier(null, from_var),
                        local: this.identifier(null, mod.used_imported_vars[from_mod][from_var].name)
                    }))
                })}
        )
    }
}
