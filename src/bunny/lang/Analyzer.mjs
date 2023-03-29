// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {list, symbol} from "../lang.mjs"
import List from "./List.mjs"
import Sym from "./Sym.mjs"

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
        return this.form.emit(cg)
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
        argv = x
        analyzer.push_locals(argv)
        body = rest.map(f=>analyzer.analyze(f))
        analyzer.pop_locals()
        return new this(form, name, Array.from(argv, s=>LocalVarExpr.from(s)), body)
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
        console.log(this)
        return cg.function_call(this, this.fn.emit(cg), this.args.map(a=>{
            if (a.emit) {
                return a.emit(cg)
            } else {
                return cg.literal(this, a)
            }}))
    }
}

class HostVarExpr extends ASTNode {
    constructor(sym, parts) {
        super(sym)
        this.parts = parts
    }

    static from(sym) {
        const parts = sym.name.split('.').reduce((acc, s)=>{
            const part = symbol(null, s)
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
        return cg.member_lookup(this, this.parts)
    }
}

class LocalVarExpr extends ASTNode {
    emit(cg) {
        return cg.identifier(this, this.form.name)
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
        const method = symbol(null, f1.name.slice(1))
        Object.assign(method, {start: f1.start, end: f1.end, line: f1.line, col: f1.col})
        const object  = analyzer.analyze(f2)
        const args = rest.map(f=>analyzer.analyze(f))
        return new this(form, method, object, args)
    }

    emit(cg) {
        return cg.method_call(this, this.method, this.object.emit(cg), this.args.map(a=>a.emit(cg)))
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

let SPECIAL_SYMBOLS = {
    "true": true,
    "false": false,
    "nil": null
}

class SpecialSymbolExpr {
    constructor(form, value) {
        this.form = form
        this.value = value
    }
    static from(form) {
        return new this(form, SPECIAL_SYMBOLS[form.name])
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
        return new this(form, INFIX_OPERATORS[op], rest.map(e=>analyzer.analyze(e)))
    }
    emit(cg) {
        return cg.infix_op(this, this.op, this.args.map(a=>a.emit(cg)))
    }
}

let SPECIALS = {
    "fn*": FnExpr,
    "def": DefExpr,
    "quote": QuoteExpr,
    "if": IfExpr,
    "defmacro": MacroVarExpr
}

export default class Analyzer {
    constructor() {
        this.locals_stack = []
    }
    analyze(form) {
        if (form instanceof List) {
            let initial = form.first()
            if (initial instanceof Sym && initial.namespace == null) {
                var expr_class;
                if (expr_class = SPECIALS[initial.name]) {
                    return expr_class.from(form, this)
                }
                if (initial.name.charAt(0) == ".") {
                    return MethodExpr.from(form, this)
                }
                if(initial.name in INFIX_OPERATORS) {
                    return InfixOpExpr.from(form, this)
                }
            }
            return InvokeExpr.from(form, this)
        } else if (form instanceof Sym) {
            if (form.namespace === null) {
                if (this.is_local(form)) {
                    var lv = LocalVarExpr.from(form, this)
                    return lv
                }
                if(form.name in SPECIAL_SYMBOLS) {
                    return SpecialSymbolExpr.from(form, this)
                }
            }
            if (form.namespace === "js") {
                return HostVarExpr.from(form, this)
            }
            return VarExpr.from(form, this)
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
