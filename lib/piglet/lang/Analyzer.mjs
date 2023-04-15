// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {list, symbol, resolve, rest, intern, remove, cons, print_str} from "../lang.mjs"
import {QName, PrefixName} from "./QName.mjs"
import List from "./List.mjs"
import Sym from "./Sym.mjs"
import {meta} from "./metadata.mjs"

function current_module() {
    return resolve(symbol("piglet", "lang", "*current-module*")).deref()
}

class ASTNode {
    constructor(form) {
        this.form = form
        this.start = form.start
        this.end = form.end
        this.line = form.line
        this.col = form.col
    }
    static from(form) {
        return new this(form)
    }
    emit(cg) {
        return cg.emit(this,this.form)
    }
}

class FnExpr extends ASTNode {
    constructor(form, name, argv, body) {
        super(form)
        this.name = name
        this.argv = argv
        this.body = body
    }

    static from(form, analyzer) {
        let name, argv, body
        this.form = form
        let [_, x, ...rest] = form
        if (x instanceof Sym) {
            name = x
            x = rest.shift()
        }
        argv = Array.from(x)
        analyzer.push_locals(argv.filter((a)=>!a.eq(symbol("&"))))
        body = rest.map(f=>analyzer.analyze(f))
        analyzer.pop_locals()
        const lasttwo = argv.slice(-2)
        const penultimate = lasttwo && lasttwo[0]
        if (symbol("&").eq(penultimate)) {
            argv = argv.slice(0,-2).map(s=>LocalVarExpr.from(s)).concat([RestExpr.from(argv.slice(-1)[0])])
        } else {
            argv = argv.map(s=>LocalVarExpr.from(s))
        }
        return new this(form, name, argv , body)
    }

    emit(cg) {
        return cg.function_expr(this, {name: this.name,
                                       argv: this.argv.map(e=>e.emit(cg)),
                                       body: this.body.map(e=>e.emit(cg))})
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
        return cg.function_call(this, this.fn.emit(cg), this.args.map(a=>cg.emit(this,a)))
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
        return cg.identifier(this, this.form.name)
    }
}

class RestExpr extends ASTNode {
    emit(cg) {
        return cg.rest_element(this, cg.identifier(this, this.form.name))
    }
}

class VarExpr extends ASTNode {
    emit(cg) {
        return cg.var_reference(this, this.form)
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
        const [_defmacro, var_sym, argv, ...rest] = form
        current_module().intern(var_sym.name, null, Object.assign({macro: true}, meta(var_sym)))
        analyzer.push_locals(argv)
        const body = rest.map(f=>analyzer.analyze(f))
        analyzer.pop_locals()
        return new this(form, var_sym, Array.from(argv, s=>LocalVarExpr.from(s)), body)
    }
    emit(cg) {
        return cg.define_var(this,
                             this.var_sym,
                             cg.function_expr(this, {name: this.name,
                                                     argv: this.argv.map(e=>e.emit(cg)),
                                                     body: this.body.map(e=>e.emit(cg))}),
                             cg.object_literal(this, [["macro", cg.literal(this, true)]]))
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

class DefExpr extends ASTNode {
    constructor(form, var_sym, value) {
        super(form)
        this.var_sym = var_sym
        this.value = value
    }
    static from(form, analyzer) {
        const [_def, var_sym, value] = form
        current_module().intern(var_sym.name, null, meta(var_sym))
        return new this(form, var_sym, analyzer.analyze(value))
    }
    emit(cg) {
        return cg.define_var(this, this.var_sym, this.value.emit(cg))
    }
}

class QuoteExpr extends ASTNode {
    emit(cg) {
        const [_, form] = this.form
        return form.emit(cg)
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
            analyzer.analyze(test),
            analyzer.analyze(if_branch),
            else_branch ? analyzer.analyze(else_branch) : null
        )
    }
    emit(cg) {
        return cg.conditional(this, this.test.emit(cg), this.if_branch.emit(cg), this.else_branch?.emit(cg))
    }
}

class AwaitExpression extends ASTNode {
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

class ModuleExpression extends ASTNode {}

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

let INFIX_OPERATORS = {
    "+": "+",
    "*": "*",
    "/": "/",
    "<": "<",
    ">": ">",
    "mod": "%",
    "power": "**",
    "==": "==",
    "===": "==="
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
        return cg.infix_op(this, this.op, this.args.map(a=>cg.emit(this,a)))
    }
}

class ArrayExpression extends ASTNode {
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

class NewExpression extends ASTNode {
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

let SPECIALS = {
    "fn*": FnExpr,
    "def": DefExpr,
    "quote": QuoteExpr,
    "if": IfExpr,
    "defmacro": MacroVarExpr,
    "array": ArrayExpression,
    "await": AwaitExpression,
    "new": NewExpression
}

export default class Analyzer {
    constructor() {
        this.locals_stack = []
    }
    analyze(form) {
        if (form instanceof List) {
            let initial = form.first()
            if (initial instanceof Sym && initial.mod == null) {
                var expr_class;
                if (expr_class = SPECIALS[initial.name]) {
                    return expr_class.from(form, this)
                }
                if (initial.name.charAt(0) == ".") {
                    if (initial.name.charAt(1) == "-") {
                        return MemberExpr.from(form, this)
                    } else {
                        return MethodExpr.from(form, this)
                    }
                }
                if(initial.name in INFIX_OPERATORS) {
                    return InfixOpExpr.from(form, this)
                }
            }
            if (initial instanceof Sym) {
                if (initial.name.endsWith(".")) {
                    return NewExpression.from(cons(symbol("new"), cons(symbol(initial.repr().slice(0, -1)), rest(form))), this)
                }
                const the_var = resolve(initial)
                if (meta(the_var)?.macro) {
                    return (this.analyze(the_var.invoke(...rest(form))))
                }
                if (the_var) {
                    return InvokeVarExpr.from(form, this)
                }
            }
            return InvokeExpr.from(form, this)
        }

        if (form instanceof Sym) {
            if (form.mod === null) {
                if (this.is_local(form)) {
                    var lv = LocalVarExpr.from(form, this)
                    return lv
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
            return new ConstantExpr(form.expand(current_module().context))
        }

        return new ConstantExpr(form)
    }

    is_local(sym) {
        let n = sym.name
        for(var locals of this.locals_stack) {
            if(locals.includes(n)) {
                return true
            }
        }
        return false
    }

    push_locals(list) {
        this.locals_stack.unshift(Array.from(list, s=>s.name))
    }

    pop_locals() {
        this.locals_stack.shift()
    }
}
