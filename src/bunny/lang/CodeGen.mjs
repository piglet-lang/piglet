// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import Module from "./Module.mjs"

export default class CodeGen {
    constructor(runtime, module) {
        this.runtime = runtime
        this.module = module
    }

    mknode(type, {node, end_node, ...props}) {
        return {type: type,
                start: node?.start,
                end: (end_node||node)?.end,
                line: node?.line,
                col: node?.col,
                ...props}
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

    member_lookup(node, syms) {
        return syms.slice(1).reduce((acc,sym)=>{
            return this.mknode('MemberExpression', {node: sym, object: acc, property: this.identifier(sym, sym.name), computed: false})
        }, this.identifier(syms[0], syms[0].name))
    }

    var_reference(node, sym) {
        let mod_name = this.module.name
        if (sym.namespaced()) {
            mod_name = this.module.aliases[sym.namespace] || sym.namespace
        }
        if (!this.runtime.find_var(mod_name, sym.name)) {
            throw(new Error("Var not found: " + mod_name + "/" + sym.name))
        }
        const mksym = n=>{
            const s = new Sym(null, n)
            s.start = node.start
            s.end = node.end
            s.end = node.end
            s.line = node.line
            s.col = node.col
            return s
        }
        return this.member_lookup(node, [mksym("$bunny$"), mksym(Module.munge(mod_name)), mksym("vars"), Module.munge(mksym(sym.name)), mksym("value")])
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

    define_var(node, name, value) {
        const mksym = n=>{
            const s = new Sym(null, n)
            s.start = node.start
            s.end = node.end
            s.end = node.end
            s.line = node.line
            s.col = node.col
            return s
        }
        return this.method_call(node,
                                mksym("intern"),
                                this.member_lookup(node, [mksym("$bunny$"), mksym(Module.munge(this.module.name))]),
                                [this.literal(name, name.name), value])
    }

    conditional(node, test, if_branch, else_branch) {
        return this.mknode('ConditionalExpression',
                           {test: test,
                            consequent: if_branch,
                            alternate: else_branch||this.literal(node, null, "null")})

    }

}
