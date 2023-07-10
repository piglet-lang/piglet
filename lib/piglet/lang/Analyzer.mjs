// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {
    cons,
    deref,
    dict,
    dict_p,
    ensure_module,
    first,
    gensym,
    get,
    intern,
    keyword,
    list,
    module_registry,
    print_str,
    println,
    reduce,
    remove,
    resolve,
    rest,
    second,
    seq,
    seq_p,
    sequential_p,
    symbol,
    symbol_p,
    with_meta,
} from "../lang.mjs"
import QName from "./QName.mjs"
import PrefixName from "./PrefixName.mjs"
import Module from "./Module.mjs"
import Sym from "./Sym.mjs"
import QSym from "./QSym.mjs"
import Dict from "./Dict.mjs"
import Context from "./Context.mjs"
import {meta, set_meta} from "./metadata.mjs"
import {PIGLET_PKG, partition_n, munge} from "./util.mjs"
import Associative from "./protocols/Associative.mjs"

function current_module() {
    return resolve(symbol("piglet", "lang", "*current-module*")).deref()
}

function current_context() {
    return resolve(symbol("piglet", "lang", "*current-context*")).deref()
}

function compiler() {
    return resolve(symbol("piglet", "lang", "*compiler*")).deref()
}

class ASTNode {
    constructor(form) {
        this.form = form
        set_meta(this, meta(form))
    }
    static from(form) {
        return new this(form)
    }
    emit(cg) {
        if (this.children) {
            return this.children.map((c)=>{return cg.emit(this, c)})
        }
        return cg.emit(this,this.form)
    }
}

class FnExpr extends ASTNode {
    constructor(form, name, argv, body, metadata) {
        super(form)
        this.name = name
        this.argv = argv
        this.body = body
        this.meta = metadata
    }

    static from(form, analyzer) {
        let name, argv, body, metadata
        this.form = form
        let [_, x, ...rest] = form
        if (x instanceof Sym || x instanceof QSym) {
            name = x
            metadata = meta(name)
            x = rest.shift()
        }
        metadata ||= dict()
        argv = Array.from(x)
        if (meta(x)) {
            argv = set_meta(Array.from(x), meta(x))
            for (const [k, v] of meta(x)) {
                metadata = metadata.assoc(k, v)
            }
        }
        try {
            analyzer.push_locals(argv.filter((a)=>!a.eq(symbol("&"))))
            analyzer.push_locals_no_gensym(name ? [name] : [])
            body = rest.map(f=>analyzer.analyze(f))
            const lasttwo = argv.slice(-2)
            const penultimate = lasttwo && lasttwo[0]
            if (symbol("&").eq(penultimate)) {
                argv = argv.slice(0,-2).map(analyzer.analyze.bind(analyzer)).concat([RestExpr.from(argv.slice(-1)[0], analyzer)])
            } else {
                argv = argv.map(analyzer.analyze.bind(analyzer))
            }
            return new this(form, name, argv, body, metadata)
        } finally {
            analyzer.pop_locals()
            analyzer.pop_locals()
        }
    }

    emit(cg) {
        return cg.function_expr(this, {name: this.name ? cg.identifier(this.name, munge(this.name.name)) : null,
                                       argv: this.argv.map(e=>e.emit(cg)),
                                       body: this.body.map(e=>e.emit(cg)),
                                       async_p: get(meta(this.name), keyword("async")),
                                       meta: this.meta
                                      })
    }
}

class ConstantExpr extends ASTNode {
}

class InvokeExpr extends ASTNode {
    constructor(form, fn, args) {
        super(form)
        this.fn = fn
        this.args = args
    }

    static from(form, analyzer) {
        const [fn, ...args] = form
        return new this(form, analyzer.analyze(fn), args.map(a=>analyzer.analyze(a)))
    }

    emit(cg) {
        return cg.function_call(this, cg.emit(this, this.fn), this.args.map(a=>cg.emit(this,a)))
    }
}

class InvokeVarExpr extends ASTNode {
    constructor(form, the_var, args) {
        super(form)
        this.the_var = the_var
        this.args = args
    }

    static from(form, analyzer) {
        const [var_sym, ...args] = form
        return new this(form, resolve(var_sym), args.map(a=>analyzer.analyze(a)))
    }
    emit(cg) {
        return cg.invoke_var(this, this.the_var.pkg, this.the_var.module, this.the_var.name, this.args.map(a=>cg.emit(this,a)))
    }
}

class HostVarExpr extends ASTNode {
    constructor(sym, parts) {
        super(sym)
        this.parts = parts
    }

    static from(sym) {
        const parts = sym.name.split('.').reduce((acc, s)=>{
            const part = symbol(null, null, s)
            const [prev] = acc.slice(-1)
            part.start = prev ? prev.end+2 : sym.start
            part.end   = part.start + part.name.length
            part.line  = sym.line
            part.col   = prev ? prev.col+2 : sym.col
            return acc.concat([part])
        }, [])
        return new this(sym, parts)
    }

    emit(cg) {
        return cg.member_lookup(this, cg.identifier(this.parts[0], this.parts[0].name), this.parts.slice(1))
    }
}

class LocalVarExpr extends ASTNode {
    emit(cg) {
        return cg.identifier(this, this.form)
    }
}

class RestExpr extends ASTNode {
    constructor(form, expr) {
        super(form)
        this.expr = expr
    }
    static from(form, analyzer) {
        return new this(form, analyzer.analyze(form))
    }
    emit(cg) {
        return cg.rest_element(this, cg.emit(this, this.expr))
    }
}

class VarExpr extends ASTNode {
    emit(cg) {
        return cg.var_value(this, this.form)
    }
}

class MacroVarExpr extends ASTNode {
    constructor(form, var_sym, argv, body) {
        super(form)
        this.var_sym = var_sym
        this.argv = argv
        this.body = body
    }
    static from(form, analyzer) {
        let [_defmacro, var_sym, argv, ...rest] = form
        current_module().intern(var_sym.name, null, Object.assign({macro: true}, meta(var_sym)))
        argv = Array.from(argv)
        try {
            analyzer.push_locals(argv.filter((a)=>!a.eq(symbol("&"))))
            const body = rest.map(f=>analyzer.analyze(f))
            const lasttwo = argv.slice(-2)
            const penultimate = lasttwo && lasttwo[0]
            if (symbol("&").eq(penultimate)) {
                argv = argv.slice(0,-2).map(s=>analyzer.analyze(s)).concat([RestExpr.from(argv.slice(-1)[0], analyzer)])
            } else {
                argv = argv.map(s=>analyzer.analyze(s))
            }
            // console.log("Defining", current_module().repr(), var_sym.toString())
            return new this(form, var_sym, argv, body)
        } finally {
            analyzer.pop_locals()
        }
    }
    emit(cg) {
        return cg.define_var(this,
                             this.var_sym,
                             cg.function_expr(this, {name: this.name,
                                                     argv: this.argv.map(e=>e.emit(cg)),
                                                     body: this.body.map(e=>e.emit(cg))}),
                             cg.emit(this, dict(keyword("macro"), true)))
    }
}

class MethodExpr extends ASTNode {
    constructor(form, method, object, args) {
        super(form)
        this.method = method
        this.object = object
        this.args = args
    }

    static from(form, analyzer) {
        const [f1, f2, ...rest] = form
        const method = symbol(null, null, f1.name.slice(1))
        Object.assign(method, {start: f1.start, end: f1.end, line: f1.line, col: f1.col})
        const object  = analyzer.analyze(f2)
        const args = rest.map(f=>analyzer.analyze(f))
        return new this(form, method, object, args)
    }

    emit(cg) {
        return cg.method_call(this, this.method, this.object.emit(cg), this.args.map(a=>cg.emit(this,a)))
    }
}

class MemberExpr extends ASTNode {
    constructor(form, object, parts) {
        super(form)
        this.object = object
        this.parts = parts
    }

    static from(form, analyzer) {
        const [f1, f2] = form
        const parts = f1.name.slice(2).split('.').reduce((acc, s)=>{
            const part = symbol(null, null, s)
            const [prev] = acc.slice(-1)
            part.start = prev ? prev.end+2 : f1.start
            part.end   = part.start + part.name.length
            part.line  = f1.line
            part.col   = prev ? prev.col+2 : f1.col
            return acc.concat([part])
        }, [])
        const object  = analyzer.analyze(f2)
        return new this(form, object, parts)
    }

    emit(cg) {
        return cg.member_lookup(this, this.object.emit(cg), this.parts)
    }
}

class BindingDeclaration extends ASTNode {
    constructor(form, var_sym, value, global) {
        super(form)
        this.var_sym = var_sym
        this.value = value
        this.global = global || true
    }

    emit(cg) {
        // console.log("Defining", current_module().repr(), this.var_sym.toString())
        if (this.global) {
            return cg.define_var(this, this.var_sym, cg.emit(this, this.value), cg.emit(this, meta(this.var_sym)))
        } else {
            // TODO
            // return cg.variable_decl(this, cg.lhs(this, this.var_sym), cg.emit(this, this.value))
        }
    }
}

class BindingExpr extends ASTNode {
    constructor(form, declarations, rhs) {
        super(form)
        this.declarations = declarations
        this.rhs = rhs
    }

    static from(form, analyzer) {
        const [_def, binding, body] = form
        //current_module().intern(var_sym.name, null, meta(var_sym))
        const declarations = []
        this.rhs_var = gensym("__temp_binding_var")
        this.rhs_var_analyzed = LocalVarExpr.from(this.rhs_var.identifier_str())
        this.rhs = analyzer.analyze(body)
        this.analyze_binding(declarations, binding, body, analyzer)
        return new this(
            form,
            declarations,
            new VariableDeclaration(
                form,
                this.rhs_var_analyzed,
                this.rhs,
            )
        )
    }

    static analyze_binding(out, binding, body, analyzer) {
        if (body === undefined || body === null) {
            // TODO: possibly support unbound declarations
            throw new Error("def must be bound to a value.")
        }
        if (symbol_p(binding)) {
            const analyzed_form = analyzer.analyze(body)
            out.push(new BindingDeclaration(binding, binding, analyzed_form, true))
        } else if (dict_p(binding)) {
            throw new Error("def associative destructuring not yet implemented.")
        } else if (sequential_p(binding)) {
            binding.map((bind, index) => {
                let rhs_form = [...Array(index + 1).keys()].reduce((acc, i) => {
                    return i === index ? list(symbol('first'), acc) : list(symbol('rest'), acc)
                }, this.rhs_var_analyzed)
                out.push(new BindingDeclaration(bind, bind, analyzer.analyze(rhs_form), true))
            })
        } else {
            throw new Error("Invalid def syntax")
        }
    }

    emit(cg) {
        const out = []
        const rhs = this.rhs.emit(cg)
        out.push(rhs)
        this.declarations.map((decl) => {
            out.push(decl.emit(cg))
        })
        return out
    }
}

class DefExpr extends ASTNode {
    constructor(form, children) {
        super(form)
        this.children = children
    }
    static from(form, analyzer) {
        const [_def, binding, body] = form
        //current_module().intern(var_sym.name, null, meta(var_sym))
        const out = []
        out.push(BindingExpr.from(form, analyzer))
        // this.analyze_binding(out, binding, body, analyzer)
        return new this(form, out)
    }

}

class QuoteExpr extends ASTNode {
    emit(cg) {
        const [_, form] = this.form
        return cg.emit(this, form)
    }
}

class IfExpr extends ASTNode {
    constructor(form, test, if_branch, else_branch) {
        super(form)
        this.test = test
        this.if_branch = if_branch
        this.else_branch = else_branch
    }
    static from(form, analyzer) {
        const [_, test, if_branch, else_branch] = form

        return new this(
            form,
            analyzer.analyze(list(symbol("piglet:lang:truthy?"), test)), // TODO: check for boolean tag
            analyzer.analyze(if_branch),
            else_branch ? analyzer.analyze(else_branch) : null
        )
    }
    emit(cg) {
        return cg.conditional(this, this.test.emit(cg), this.if_branch.emit(cg), this.else_branch?.emit(cg))
    }
}

class AwaitExpr extends ASTNode {
    constructor(form, arg) {
        super(form)
        this.arg = arg
    }
    static from(form, analyzer) {
        const [_, arg] = form
        return new this(form, analyzer.analyze(arg))
    }
    emit(cg) {
        return cg.await_expr(this, cg.emit(this, this.arg))
    }
}

class SpecialSymbolExpr {
    static SPECIALS = {
        "true": true,
        "false": false,
        "nil": null,
        "undefined": void(0)
    }

    constructor(form, value) {
        this.form = form
        this.value = value
    }
    static from(form) {
        return new this(form, this.SPECIALS[form.name])
    }
    static is_special(s) {
        return s in this.SPECIALS
    }
    emit(cg) {
        return cg.literal(this, this.value)
    }
}

const INFIX_OPERATORS = {
    "+": "+",
    "*": "*",
    "/": "/",
    "<": "<",
    ">": ">",
    ">=": ">=",
    "<=": "<=",
    "mod": "%",
    "power": "**",
    "==": "==",
    "===": "===",
    "instance?": "instanceof",
    "and": "&&",
    "or": "||"
}

const BOOLEAN_INFIX_OPERATORS = ["<", ">", "<=", ">=", "==", "===", "instanceof", "&&", "||"]

const UNARY_OPERATORS = {
    "typeof": "typeof",
    // TODO: we can only emit this when we know we have a true boolean, if not we must go through truthy?
    // "not": "!"
}

class InfixOpExpr extends ASTNode {
    constructor(form, op, args) {
        super(form)
        this.op = op
        this.args = args
    }
    static from(form, analyzer) {
        const [op, ...rest] = form
        return new this(form, INFIX_OPERATORS[op.name], rest.map(e=>analyzer.analyze(e)))
    }
    emit(cg) {
        if (this.op === 'instanceof') {
            return cg.infix_op(this, this.op, this.args.reverse().map(a=>cg.emit(this,a)))
        }
        if (BOOLEAN_INFIX_OPERATORS.includes(this.op)) {
            return cg.boolean_infix_op(this, this.op, this.args.map(a=>cg.emit(this,a)))
        }
        return cg.infix_op(this, this.op, this.args.map(a=>cg.emit(this,a)))
    }
}

class UnaryOpExpr extends ASTNode {
    constructor(form, op, argument) {
        super(form)
        this.op = op
        this.argument = argument
    }
    static from(form, analyzer) {
        const [op, arg] = form
        return new this(form, UNARY_OPERATORS[op.name], analyzer.analyze(arg))
    }
    emit(cg) {
        return cg.unary_expression(this, this.op, cg.emit(this.argument, this.argument), true)
    }
}

class ArrayExpr extends ASTNode {
    constructor(form, args) {
        super(form)
        this.args = args
    }
    static from(form, analyzer) {
        const [_, ...rest] = form
        return new this(form, rest.map(e=>analyzer.analyze(e)))
    }
    emit(cg) {
        return cg.array_literal(this, this.args.map(a=>cg.emit(this,a)))
    }
}

class NewExpr extends ASTNode {
    constructor(form, ctor, args) {
        super(form)
        this.ctor = ctor
        this.args = args
    }
    static from(form, analyzer) {
        const [_, ctor, ...rest] = form
        return new this(form, analyzer.analyze(ctor), rest.map(e=>analyzer.analyze(e)))
    }
    emit(cg) {
        return cg.new_expr(this, cg.emit(this, this.ctor), this.args.map(a=>cg.emit(this,a)))
    }
}

class VectorExpr extends ASTNode {
    constructor(form, coll) {
        super(form)
        this.coll = coll
    }
    static from(form, analyzer) {
        return new this(form, set_meta(Array.from(form, e=>analyzer.analyze(e)), meta(form)))
    }
    emit(cg) {
        return cg.emit(this, this.coll)
    }
}

class DictExpr extends ASTNode {
    constructor(form, dict) {
        super(form)
        this.dict = dict
    }
    static from(form, analyzer) {
        return new this(
            form,
            with_meta(
                reduce((d, [k, v])=>Associative._assoc(d, analyzer.analyze(k), analyzer.analyze(v)),
                       Dict.EMPTY,
                       form),
                meta(form)
            )
        )
    }
    emit(cg) {
        return cg.emit(this, this.dict)
    }
}

class JsObjLiteral extends ASTNode {
    constructor(form, obj) {
        super(form)
        this.obj = obj
    }
    static from(form, analyzer) {
        return new this(
            form,
            Array.from(Object.entries(form)).reduce((acc, [k, v])=>(acc[k]=analyzer.analyze(v), acc), {})
        )
    }
    emit(cg) {
        return cg.object_literal(this, Object.entries(this.obj).map(([k, v])=>[cg.emit(k, k), cg.emit(v, v)], {}))
    }
}

class VariableDeclaration extends ASTNode {
    constructor(form, identifier, rhs) {
        super(form)
        this.identifier = identifier
        this.rhs = rhs
    }
    emit(cg) {
        return cg.variable_decl(this, cg.lhs(this, this.identifier), cg.emit(this, this.rhs))
    }
}

class LetExpr extends ASTNode {
    constructor(form, children) {
        super(form)
        this.children = children
    }
    static from(form, analyzer) {
        const [_, bindings, ...body] = form
        const out = []
        this.analyze_bindings(out, partition_n(2, bindings), body, analyzer)
        return new this(form, out)
    }
    static analyze_bindings(out, binding_pairs, body, analyzer) {
        if (!(seq(body))) {
            body = [Sym.parse("nil")]
        }
        if (seq(binding_pairs)) {
            const [bind, form] = first(binding_pairs)
            if (symbol_p(bind)) {
                const analyzed_form = analyzer.analyze(form)
                try {
                    analyzer.push_locals([bind])
                    out.push(new VariableDeclaration(bind, analyzer.analyze(bind), analyzed_form))
                    this.analyze_bindings(out, rest(binding_pairs), body, analyzer)
                } finally {
                    analyzer.pop_locals([bind])
                }
            } else if (dict_p(bind)) {
                let props = bind.get(keyword("props"))
                if (props) {
                    if (Array.from(props).flat().every(symbol_p)) {
                        analyzer.push_locals(Array.from(props).flat())
                        for(let arg of props) {
                            let arg_form = form.get(keyword(arg.identifier_str()))
                            out.push(new VariableDeclaration(bind, this.analyze_lhs(arg, analyzer), analyzer.analyze(arg_form)))
                        }
                        this.analyze_bindings(out, rest(binding_pairs), body, analyzer)
                        analyzer.pop_locals([props])
                    }
                }
            } else if(sequential_p(bind)) {
                const analyzed_form = analyzer.analyze(form)
                if(Array.from(bind).flat().every(symbol_p)) {
                    try {
                        analyzer.push_locals(Array.from(bind).flat())
                        out.push(new VariableDeclaration(bind, this.analyze_lhs(bind, analyzer), analyzed_form))
                        this.analyze_bindings(out, rest(binding_pairs), body, analyzer)
                    } finally {
                        analyzer.pop_locals([bind])
                    }
                }
            }
        } else {
            out.push(...body.map(e=>analyzer.analyze(e)))
        }
    }
    static analyze_lhs(lhs, analyzer) {
        if (Array.isArray(lhs)) {
            return lhs.map((e)=>this.analyze_lhs(e, analyzer))
        }
        const local = analyzer.get_local(lhs)
        return LocalVarExpr.from(local, analyzer)
    }
}

class SetExpr extends ASTNode {
    constructor(form, left, right) {
        super(form)
        this.left = left
        this.right = right
    }
    static from(form, analyzer) {
        const [_, left, right] = form
        return new this(form, analyzer.analyze(left), analyzer.analyze(right))
    }
    emit(cg) {
        return cg.assignment(this, cg.emit(this, this.left), cg.emit(this, this.right))
    }
}

class DoExpr extends ASTNode {
    constructor(form, body) {
        super(form)
        this.body = body
    }
    static from(form, analyzer) {
        const [_, ...rest] = form
        return new this(form, rest.map((f)=>analyzer.analyze(f)))
    }
    emit(cg) {
        return this.body.map((e) => cg.emit(this, e))
    }
}

class ModuleExpr extends ASTNode {
    constructor(form, children) {
        super(form)
        this.children = children
    }
    static from(form, analyzer) {
        // console.log(`Analyzing module form, current-module=${current_module().inspect()}, analyzing=${Array.from(form)[1].inspect()}`)
        const current_package = deref(resolve(symbol('piglet:lang:*current-package*')))
        const mod_opts = Module.parse_opts(current_package.name, form)
        // const interned_mod = ensure_module(current_package, mod_opts.get('name'))
        const interned_mod = module_registry.parse_module_form(current_package, form)
        interned_mod.location = deref(resolve(symbol('piglet:lang:*current-location*')))
        try {
            analyzer.push_locals([interned_mod.self_ref])
            const analyze = analyzer.analyze.bind(analyzer)
            const self = interned_mod.self_ref
            const children = [
                (new VariableDeclaration(
                    this,
                    analyzer.analyze(self),
                    analyze(
                        list(symbol('.register_module'),
                             symbol('piglet:lang:module-registry'),
                             list(symbol('quote'),
                                  {pkg: interned_mod.pkg,
                                   name: interned_mod.name,
                                   imports: interned_mod.imports.map((({alias, from})=>({alias:alias, from: from.fqn}))),
                                   context: interned_mod?.context,
                                   location: interned_mod.location,
                                   self_ref: self}))
                    ))),

                analyze(list(symbol('piglet:lang:intern'),
                             list(symbol('quote'), symbol('piglet:lang:*current-module*')),
                             self)),
                analyze(list(symbol('piglet:lang:intern'),
                             list(symbol('quote'), symbol('piglet:lang:*current-context*')),
                             list(symbol('.-context'), interned_mod.self_ref))),
                ...(interned_mod.imports.map(({from, alias, js_module, module_path})=>{
                    if (js_module) {
                        return analyze(
                            list(symbol('.set_alias'),
                                 self,
                                 alias.name,
                                 list(symbol('await'),
                                      list(symbol('piglet:lang:js-import'), module_path)))
                        )
                    }
                    return analyze(list(symbol('await'), list(symbol('piglet:lang:require'), list(symbol("quote"), from.fqn))))
                })),
                self
            ]
            return new this(form, children)
        } finally {
            analyzer.pop_locals()
        }
    }
}

class ThrowExpr extends ASTNode {
    constructor(form, argument) {
        super(form)
        this.argument = argument
    }
    static from(form, analyzer) {
        return new this(form, analyzer.analyze(second(form)))
    }
    emit(cg) {
        return cg.throw(this, cg.emit(this.argument, this.argument))
    }
}

let SPECIALS = {
    "fn*": FnExpr,
    "def": DefExpr,
    "quote": QuoteExpr,
    "if": IfExpr,
    "defmacro": MacroVarExpr,
    // "array": ArrayExpr,
    "await": AwaitExpr,
    "new": NewExpr,
    "let": LetExpr,
    "set!": SetExpr,
    "do": DoExpr,
    "module": ModuleExpr,
    "throw": ThrowExpr
}

export default class Analyzer {
    constructor() {
        this.locals_stack = []
    }
    analyze(form) {
        if (seq_p(form)) {
            if (!seq(form)) {
                return QuoteExpr.from(list(symbol("quote"), form))
            }
            const initial = first(form)
            // console.log("initial", print_str(initial))
            if (initial instanceof Sym && initial.mod == null) {
                let expr_class;
                if (expr_class = SPECIALS[initial.name]) {
                    return expr_class.from(form, this)
                }
                if(initial.name in INFIX_OPERATORS) {
                    return InfixOpExpr.from(form, this)
                }
                if(initial.name in UNARY_OPERATORS) {
                    return UnaryOpExpr.from(form, this)
                }
                if (initial.name.charAt(0) == ".") {
                    if (initial.name.charAt(1) == "-") {
                        return MemberExpr.from(form, this)
                    } else {
                        return MethodExpr.from(form, this)
                    }
                }
            }
            if (initial instanceof Sym || initial instanceof QSym) {
                const local = this.get_local(initial)
                if (local) {
                    return InvokeExpr.from(form, this)
                }
                if (initial.name.endsWith(".")) {
                    return NewExpr.from(cons(symbol("new"), cons(symbol(initial.toString().slice(0, -1)), rest(form))), this)
                }
                if (initial.pkg === PIGLET_PKG && initial.mod === "lang") {
                    let expr_class;
                    if (expr_class = SPECIALS[initial.name]) {
                        return expr_class.from(form, this)
                    }
                    if(initial.name in INFIX_OPERATORS) {
                        return InfixOpExpr.from(form, this)
                    }
                    if(initial.name in UNARY_OPERATORS) {
                        return UnaryOpExpr.from(form, this)
                    }
                }
                const the_var = resolve(initial)
                if (get(meta(the_var), keyword("macro"))) {
                    const expanded = the_var(...(rest(form) || []))
                    // println(expanded)
                    return (this.analyze(expanded))
                }
                if (the_var) {
                    return InvokeVarExpr.from(form, this)
                }
            }
            return InvokeExpr.from(form, this)
        }

        if (Array.isArray(form)) { // currently [...] reads as an array, that will likely change
            return VectorExpr.from(form, this)
        }

        if (dict_p(form)) {
            return DictExpr.from(form, this)
        }

        if (form instanceof Sym || form instanceof QSym) {
            if (form.mod === null) {
                const local = this.get_local(form)
                if (local) {
                    return LocalVarExpr.from(local, this)
                }
                if (SpecialSymbolExpr.is_special(form.name)) {
                    return SpecialSymbolExpr.from(form, this)
                }
            }
            if (form.pkg === null && form.mod === "js") {
                return HostVarExpr.from(form, this)
            }
            return VarExpr.from(form, this)
        }

        if (form instanceof PrefixName) {
            return new ConstantExpr(Context.expand(current_context(), form))
        }

        if (form && typeof form === 'object' && !form.emit) {
            return JsObjLiteral.from(form, this)
        }

        return new ConstantExpr(form)
    }

    get_local(sym) {
        let n = sym.name
        for(var locals of this.locals_stack) {
            if(n in locals) {
                return locals[n]
            }
        }
        return false
    }

    push_locals(list) {
        this.locals_stack.unshift(Array.from(list).reduce((acc, s) => (acc[s.name]=munge(gensym(s.name).name), acc), {}))
    }

    push_locals_no_gensym(list) {
        this.locals_stack.unshift(Array.from(list).reduce((acc, s) => (acc[s.name]=munge(s.name), acc), {}))
    }

    pop_locals() {
        this.locals_stack.shift()
    }
}
