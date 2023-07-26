// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {
    assoc,
    cons,
    conj,
    count,
    deref,
    dict,
    dict_p,
    eq,
    ensure_module,
    first,
    gensym,
    get,
    hash_code,
    intern,
    keyword,
    keyword_p,
    list,
    map,
    module_registry,
    prewalk,
    print_str,
    println,
    reduce,
    remove,
    resolve,
    rest,
    second,
    select_keys,
    seq,
    seq_p,
    sequential_p,
    set_p,
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
import HashSet from "./HashSet.mjs"
import Hashable from "./protocols/Hashable.mjs"
import WithMeta from "./protocols/WithMeta.mjs"
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

Hashable.extend(
    ASTNode, [(function _hash_code(self) { return hash_code(self.form) })],
)

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
                argv = argv.slice(0,-2).map(analyzer.analyze_without_meta.bind(analyzer)).concat([RestExpr.from(argv.slice(-1)[0], analyzer)])
            } else {
                argv = argv.map(analyzer.analyze_without_meta.bind(analyzer))
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
                                       async_p: get(meta(this.name), keyword("async"))
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
        return new this(form, analyzer.analyze_without_meta(fn), args.map(a=>analyzer.analyze(a)))
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

class VarLookupExpr extends ASTNode {
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

class GlobalBindingDeclaration extends ASTNode {
    constructor(form, var_sym, value, meta) {
        super(form)
        this.var_sym = var_sym
        this.value = value
        this.meta = meta
    }

    static meta_keys = [keyword("start"), keyword("end"), keyword("col"), keyword("line"), keyword("file"), keyword("location")]

    static from(form, analyzer, var_sym, rhs_form) {
        const meta_form = reduce(conj, meta(var_sym), select_keys(meta(form), this.meta_keys))
        return new this(form, var_sym, analyzer.analyze(rhs_form), analyzer.analyze_without_meta(meta_form))
    }

    emit(cg) {
        return cg.define_var(this, this.var_sym, cg.emit(this, this.value), cg.emit(this, this.meta))
    }
}

class LocalBindingDeclaration extends ASTNode {
    constructor(form, var_sym, value) {
        super(form)
        this.var_sym = var_sym
        this.value = value
    }

    static from(form, analyzer, var_sym, rhs_form) {
        return new this(form, analyzer.analyze_without_meta(var_sym), analyzer.analyze(rhs_form))
    }

    emit(cg) {
        return cg.variable_decl(this, cg.emit(this, this.var_sym), cg.emit(this, this.value))
    }
}

class BindingDeclarator extends ASTNode {
    constructor(form, declarations, global) {
        super(form)
        this.children = declarations
        this.global = global
    }

    static from(form, binding_pair, analyzer, global) {
        const [binding, body] = binding_pair
        if (symbol_p(binding)) {
            const declarations = []
            this.analyze_binding(declarations, form, binding, analyzer.analyze(body), analyzer, global)
            return new this(
                binding_pair,
                declarations,
                global
            )
        }
        const rhs_var = gensym("__temp_binding_var")
        const rhs_var_analyzed = LocalVarExpr.from(rhs_var.identifier_str())
        const rhs = analyzer.analyze(body)
        const declarations = [new VariableDeclaration(
            body,
            rhs_var_analyzed,
            rhs
        )]
        this.analyze_binding(declarations, form, binding, rhs_var_analyzed, analyzer, global)
        return new this(
            binding_pair,
            declarations,
            global
        )
    }

    static create_push_binding(analyzer, out, form, sym_or_identifier, rhs_form, global) {
        if (global) {
            out.push(GlobalBindingDeclaration.from(form, analyzer, sym_or_identifier, rhs_form))
        } else {
            analyzer.push_locals([sym_or_identifier])
            out.push(LocalBindingDeclaration.from(form, analyzer, sym_or_identifier, rhs_form, global))
        }
    }

    static analyze_binding(out, form, binding, body, analyzer, global) {
        if (body === undefined || body === null) {
            // TODO: possibly support unbound declarations
            throw new Error("def must be bound to a value.")
        }
        if (symbol_p(binding)) {
            const analyzed_form = analyzer.analyze(body)
            if (global) {
                out.push(GlobalBindingDeclaration.from(form, analyzer, binding, analyzed_form, global))
            } else {
                analyzer.push_locals([binding])
                out.push(LocalBindingDeclaration.from(form, analyzer, binding, analyzed_form, global))
            }
        } else if (dict_p(binding)) {
            for (let [bind, lookup] of binding) {
                if (keyword_p(bind)) {
                    if (bind.eq(keyword("strs")) || bind.eq(keyword("keys")) || bind.eq(keyword("props")) || bind.eq(keyword("syms"))) {
                        if (!sequential_p(lookup)) {
                            throw new Error("Special :strs, :keys, or :props destructuring require a sequential collection.")
                        }
                        for (let lookup_sym of lookup) {
                            if (!symbol_p(lookup_sym)) {
                                throw new Error("Special :strs, :keys, or :props destructuring require a sequential collection of symbols.")
                            }
                            let key = lookup_sym.identifier_str()
                            if (bind.eq(keyword("keys"))) {
                                key = keyword(key)
                            } else if (bind.eq(keyword("syms"))) {
                                key = list(symbol('quote'), lookup_sym)
                            }
                            let rhs_form = list(symbol('get'), body, key)
                            this.create_push_binding(analyzer, out, form, lookup_sym, rhs_form, global)
                        }
                    }
                } else {
                    let rhs_form = list(symbol('get'), body, lookup)
                    if (dict_p(bind) || sequential_p(bind)) {
                        this.analyze_binding(out, bind, rhs_form, analyzer, global)
                    } else {
                        this.create_push_binding(analyzer, out, form, bind, rhs_form, global)
                    }
                }
            }
        } else if (sequential_p(binding)) {
            let as_binding = null
            let splat_binding = null
            let lasttwo = binding.slice(-2)
            let penultimate = lasttwo && lasttwo[0]

            if (binding && keyword_p(binding[0]) && binding[0].eq(keyword("as"))) {
                binding.shift()
                as_binding = binding.shift()
            }
            if (keyword_p(penultimate) && penultimate.eq(keyword("as"))) {
                as_binding = binding.pop()
                binding.pop()
            }
            if (as_binding) {
                if (!symbol_p(as_binding)) {
                    throw new Error(":as binding must be a symbol.")
                }
                this.create_push_binding(analyzer, out, form, as_bind, body, global)
            }
            lasttwo = binding.slice(-2)
            penultimate = lasttwo && lasttwo[0]
            if (symbol_p(penultimate) && penultimate.eq(symbol("&"))) {
                splat_binding = binding.pop()
                binding.pop()
                if (!symbol_p(splat_binding)) {
                    throw new Error("Splat binding must be a symbol.")
                }
                let rhs_form = list(symbol('drop'), binding.length, body)
                this.create_push_binding(analyzer, out, form, splat_binding, rhs_form, global)
            }
            binding.map((bind, index) => {
                let rhs_form = [...Array(index + 1).keys()].reduce((acc, i) => {
                    return i === index ? list(symbol('first'), acc) : list(symbol('rest'), acc)
                }, body)
                if (dict_p(bind) || sequential_p(bind)) {
                    this.analyze_binding(out, bind, rhs_form, analyzer, global, locals)
                } else {
                    this.create_push_binding(analyzer, out, form, bind, rhs_form, global)
                }
            })
        } else {
            throw new Error("Invalid def syntax")
        }
    }
}

class DefExpr extends ASTNode {
    constructor(form, binding_pair, binding_declarator) {
        super(form)
        this.binding_pair = binding_pair
        this.binding_declarator = binding_declarator
    }
    static from(form, analyzer) {
        const [_def, binding, body] = form
        const binding_pair = [binding, body]
        const declarator = BindingDeclarator.from(form, binding_pair, analyzer, true)
        return new this(form, binding_pair, declarator)
    }

    emit(cg) {
        return cg.emit(this, this.binding_declarator)
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
        return new this(form, Array.from(form, e=>analyzer.analyze(e)))
        // return new this(form, set_meta(Array.from(form, e=>analyzer.analyze(e)), meta(form)))
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

class HashSetExpr extends ASTNode {
    constructor(form, set) {
        super(form)
        this.set = set
    }
    static from(form, analyzer) {
        return new this(
            form,
            HashSet.of(meta(form), ...map(analyzer.analyze.bind(analyzer), form))
        )
    }
    emit(cg) {
        return cg.emit(this, this.set)
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
        return cg.object_literal(this, Object.entries(this.obj).map(([k, v]) => [cg.emit(k, k), cg.emit(v, v)], {}))
    }
}

class LetExpr extends ASTNode {
    constructor(form, children) {
        super(form)
        this.children = children
    }
    static from(form, analyzer) {
        let [_, bindings, ...body] = form
        const out = []
        const binding_pairs = partition_n(2, bindings)
        let declarator;
        let locals_stack = analyzer.capture_locals()
        binding_pairs.map(binding_pair => {
            declarator = BindingDeclarator.from(form, binding_pair, analyzer, false)
            out.push(declarator)
        })
        if (!(seq(body))) {
            body = [Sym.parse("nil")]
        }
        out.push(...body.map(e=>analyzer.analyze(e)))
        analyzer.reset_locals(locals_stack)
        return new this(form, out)
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
        return cg.throw_stmt(this, cg.emit(this.argument, this.argument))
    }
}

class VarExpr extends ASTNode {
    emit(cg) {
        return cg.var_ref(this, second(this.form))
    }
}

class WhileExpr extends ASTNode {
    constructor(form, test, body) {
        super(form)
        this.test = test
        this.body = body
    }
    static from(form, analyzer) {
        const [test, ...body] = Array.from(rest(form), (f)=>analyzer.analyze(f))
        return new this(form, test, body)
    }
    emit(cg) {
        return cg.while_stmt(this, this.test, this.body)
    }
}

class MetaExpr extends ASTNode {
    constructor(form, analyzed_form, meta) {
        super(form)
        this.analyzed_form = analyzed_form
        this.meta = meta
    }
    static from(form, analyzed_form, analyzer) {
        analyzer.emit_meta = false
        const meta_expr = analyzer.analyze(meta(form))
        analyzer.emit_meta = true
        return new this(form, analyzed_form, meta_expr)
    }
    emit(cg) {
        return cg.wrap_set_meta(
            cg.emit(this.form, this.analyzed_form),
            this.meta
        )
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
    "throw": ThrowExpr,
    "var": VarExpr,
    "while": WhileExpr
}

export default class Analyzer {
    constructor() {
        this.locals_stack = []
        this.emit_meta = true
    }

    analyze(form) {
        const expr = this.analyze_without_meta(form, this)
        if (!this.emit_meta) { return expr }
        const t = expr.constructor
        if (VectorExpr === t || DictExpr === t || QuoteExpr === t) {
            return MetaExpr.from(form, expr, this)
        }
        // if (ConstantExpr == t) {
        //     const tc = expr.form.constructor
        //     if (Keyword === tc || Symbol === tc) {
        //         return MetaExpr.from(form, expr, this)
        //     }
        // }
        return expr
    }

    analyze_without_meta(form) {
        const before = form
        form = prewalk((f)=>{
            if (seq_p(f) && seq(f) && first(f) instanceof Sym && first(f).name.endsWith(".")) {
                return cons(symbol("new"), cons(symbol(first(f).toString().slice(0, -1)), rest(f)))
            }
            if (f instanceof Sym) {
                if (!(f.name.startsWith(".")) && f.name.includes(".")) {
                    const parts = f.name.split(".")
                    return parts.slice(1).reduce((acc, part)=>list(symbol(`.-${part}`), acc), f.with_name(parts[0]))
                }
            }
            return f
        },form)

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
                if(initial.name in INFIX_OPERATORS && count(form) >= 3) {
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

        if (set_p(form)) {
            return HashSetExpr.from(form, this)
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
            return VarLookupExpr.from(form, this)
        }

        if (form instanceof PrefixName) {
            return new ConstantExpr(Context.expand(current_context(), form))
        }

        if (form instanceof RegExp) {
            return new ConstantExpr(form)
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

    capture_locals() {
        return Array.from(this.locals_stack)
    }

    reset_locals(locals_stack) {
        this.locals_stack = locals_stack
    }
}
