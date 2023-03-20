// Copyright (c) Arne Brasseur 2023. All rights reserved.

import List from "./List.mjs"
import Sym from "./Sym.mjs"
import {GLOBAL_SCOPE, CURRENT_MODULE} from "./runtime.mjs"

function member_lookup(syms) {
    return syms.reduce((acc,id)=>{
        return {type: 'MemberExpression',
                start: acc.start,
                end: id.end,
                object: acc,
                property: id,
                computed: false}
    })
}

function string_literal(s) {
    return {type: "Literal", value: s, raw: JSON.stringify(s)}
}

function identifier(i) {
    return {type: "Identifier", name: i}
}

function global_lookup(elements) {
    return elements.reduce(
        (acc,el)=>{
            return {
                type: 'MemberExpression',
                object: acc,
                property: (el.type ? el : {type: "Identifier", name: el.name}),
                computed: el.computed || false
            }
        },
        {type: "Identifier", name: GLOBAL_SCOPE.deref()},)
}

function method_call(callee, method, args) {
    return {type: "CallExpression",
            callee: {type: "MemberExpression",
                     object: callee,
                     property: identifier(method)},
            arguments: args}
}

function module_lookup(module_name) {
    return {type: "MemberExpression",
            object: global_lookup([{name: "bunny"}, {name: "modules"}]),
            property: string_literal(module_name),
            computed: true}
}

function var_lookup(module_name, var_name) {
    return method_call(
        method_call(module_lookup(module_name),
                    "get_var",
                    [string_literal(var_name)]),
        "deref",
        [])
}


class FnExpr {
    constructor(form, name, argv, body) {
        this.form = form
        this.name = name
        this.argv = argv
        this.body = body
    }

    static from(form, analyzer) {
        var name, argv, body
        this.form = form
        let iter = form[Symbol.iterator]()
        iter.next() // fn*
        var x = iter.next().value
        if (x instanceof Sym) {
            name = x
            x = iter.next().value
        }
        argv = x
        analyzer.push_locals(argv)
        body = Array.from(iter, f=>analyzer.analyze(f))
        analyzer.pop_locals()
        return new FnExpr(form, name, Array.from(argv, s=>LocalVarExpr.from(s)), body)
    }
    estree() {
        let body = this.body.map(e=>e.estree())
        if (body.length == 0) {
            return {type: "FunctionExpression",
                    start: this.form.end,
                    end: this.form.end,
                    id: null,
                    expression: false,
                    generator: false,
                    params: this.argv.map(a=>a.estree()),
                    body: {type: "BlockStatement",
                           start: (body[0]||this.form).start,
                           end: (body[this.body.length-1]||this.form).end,
                           body: body}}
        }
        body[body.length-1] = {
            type: 'ReturnStatement',
            start: 14,
            end: 22,
            argument: body[body.length-1]
        }
        return {type: "FunctionExpression",
                start: this.form.start,
                end: this.form.end,
                id: null,
                expression: false,
                generator: false,
                params: this.argv.map(a=>a.estree()),
                body: {type: "BlockStatement",
                       start: body[0].start,
                       end: body[this.body.length-1].end,
                       body: body}}}
}

class ConstantExpr {
    constructor(form) {
        this.form = form
    }
    estree() {
        return this.form.estree()
    }
}

class InvokeExpr {
    constructor(form, fn, args) {
        this.form = form
        this.fn = fn
        this.args = args
    }

    static from(form, analyzer) {
        let iter = form[Symbol.iterator]()
        let fn = analyzer.analyze(iter.next().value)
        let args = Array.from(iter, f=>analyzer.analyze(f))
        return new InvokeExpr(form, fn, args)
    }
    estree() {
        return {
            type: 'CallExpression',
            start: this.form.start,
            end: this.form.end,
            callee: this.fn.estree(),
            arguments: this.args.map(a=>a.estree())
        }
    }
}

class HostVarExpr {
    constructor(sym) {
        this.var = sym
    }
    static from(sym) {
        let s = new Sym(null, sym.name)
        s.start = sym.start
        s.end = sym.end
        s.col = sym.col
        s.row = sym.row
        return new HostVarExpr(s)
    }

    estree() {
        if (this.var.name.includes('.')) {
            var ids = this.var.name.split('.').map(s=>{return {type: 'Identifier', name: s}})
            var start = this.var.start
            for (var id of ids) {
                id.start = start
                start = id.end = start + id.name.length
                start++
            }
            return member_lookup(ids)
        } else {
            return {type: 'Identifier', name: this.var.name, start: this.var.start, end: this.var.end}
        }
    }
}

class LocalVarExpr {
    constructor(sym) {
        this.var = sym
    }
    static from(sym) {
        return new LocalVarExpr(new Sym(null, sym.name))
    }
    estree() {
        return {type: 'Identifier', name: this.var.name, start: this.var.start, end: this.var.end}
    }
}

class VarExpr {
    constructor(sym) {
        this.var = sym
    }
    static from(sym) {
        return new VarExpr(new Sym(null, sym.name))
    }
    estree() {
        let mod = CURRENT_MODULE.deref()
        var mod_name = mod.name
        if (this.var.isNamespaced()) {
            mod_name = mod.aliases.get(this.var.namespace) || this.var.namespace
        } else if (!mod.isDefined(this.var.name)) {
            mod_name = "bunny.lang"
        }
        return var_lookup(mod_name, this.var.name)
    }
}

class MethodExpr {
    constructor(form, method_name, object, args) {
        this.form = form
        this.method_name = method_name
        this.object = object
        this.args = args
    }

    static from(form, analyzer) {
        let iter = form[Symbol.iterator]()
        let method_name = iter.next().value.name.substr(1)
        let object  = analyzer.analyze(iter.next().value)
        let args = Array.from(iter, f=>analyzer.analyze(f))
        return new MethodExpr(form, method_name, object, args)
    }

    estree() {
        return {type: 'CallExpression',
                start: this.form.start,
                end: this.form.end,
                callee:  {type: 'MemberExpression',
                          start: this.form.start,
                          end: this.form.end,
                          object: this.object.estree(),
                          property: identifier(this.method_name),
                          computed: false},
                arguments: this.args.map(a=>a.estree())}
    }
}

class DefExpr {
    constructor(form, var_name, value) {
        this.form = form
        this.var_name = var_name
        this.value = value
    }
    static from(form, analyzer) {
        let iter = form[Symbol.iterator]()
        iter.next()
        let var_name = iter.next().value
        let value  = analyzer.analyze(iter.next().value)
        return new DefExpr(form, var_name.name, value)
    }
    estree() {
        return method_call(
            module_lookup(CURRENT_MODULE.deref().name),
            "intern",
            [string_literal(this.var_name),
             this.value.estree()]
        )
    }
}

class QuoteExpr {
    constructor(form) {
        this.form = form
    }
    from(form) {
        return new QuoteExpr(form)
    }
    estree() {
        return this.form.estree()
    }
}

let SPECIALS = {
    "fn*": FnExpr,
    "def": DefExpr,
    "quote": QuoteExpr
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
                } else if (initial.name.charAt(0) == ".") {
                    return MethodExpr.from(form, this)
                }
            }
            return InvokeExpr.from(form, this)
        } else if (form instanceof Sym) {
            if (form.namespace === "js") {
                return HostVarExpr.from(form, this)
            } else if (form.namespace == null && this.is_local(form)) {
                var lv = LocalVarExpr.from(form, this)
                return lv
            } else {
                return VarExpr.from(form, this)
            }
        } else {
            return new ConstantExpr(form)
        }
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