// Copyright (c) Arne Brasseur 2023. All rights reserved.

class Sym {
    constructor(ns, name) {
        this.namespace = ns
        this.name = name
    }

    repr() {
        if (this.namespace) {
            return this.namespace + "/" + this.name
        } else {
            return this.name
        }
    }

    eq(other) {
        return (other instanceof Sym) && this.namespace === other.namespace && this.name === other.name
    }

    isNamespaced() {
        return !!this.namespace;
    }
}

class Number {
    constructor(raw, value) {
        this.raw = raw
        this.value = value
    }

    repr() {
        return this.raw
    }

    eq(other) {
        return (other instanceof Number) && this.value === other.value
    }

    estree() {
        return {"type": "Literal",
                "start": this.start,
                "end": this.end,
                "value": this.value,
                "raw": this.raw}
    }
}

class String {
    constructor(raw, value) {
        this.raw = raw
        this.value = value
    }

    repr() {
        return this.raw
    }

    eq(other) {
        return (other instanceof Number) && this.value === other.value
    }

    estree() {
        return {"type": "Literal",
                "start": this.start,
                "end": this.end,
                "value": this.value,
                "raw": this.raw}
    }
}

class List {
    constructor(elements) {
        this.elements = elements
    }

    first() {
        return this.elements[0]
    }

    rest() {
        return this.elements.slice(1)
    }

    eq(other) {
        if (!(other instanceof List)) return false
        let i1 = this[Symbol.iterator]
        let i2 = other[Symbol.iterator]

    }

    toString() {
        return "(" + this.elements.map(e=>e.toString()).join(" ") + ")"
    }

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }
}

class Var {
    constructor(module, name, value, meta) {
        this.module = module
        this.name = name
        this.binding_stack = [value]
        this.meta = meta
    }

    deref() {
        return this.binding_stack[0]
    }

    invoke(args) {
        return this.deref().apply(null, args)
    }

    set_value(value) {
        this.binding_stack[0] = value
    }

    push_binding(value) {
        this.binding_stack.unshift(value)
    }

    pop_binding(value) {
        this.binding_stack.shift(value)
    }
}

class Module {
    constructor(name) {
        this.name = name
        this.vars = {}
        this.aliases = {}
    }

    get_var(name) {
        return this.vars[name] || (this.vars[name] = new Var(this.name, name, null, null))
    }

    isDefined(name) {
        return !!this.vars[name]
    }
}

let MODULE_USER = new Module("user")
let MODULE_BUNNY_LANG = new Module("bunny.lang")

let GLOBAL_SCOPE = new Var("bunny.lang", "global-scope", null)
let CURRENT_MODULE = new Var("bunny.lang", "*current-module*", MODULE_USER)
MODULE_BUNNY_LANG.vars["*current-module*"] = CURRENT_MODULE
MODULE_BUNNY_LANG.vars["global-scope"] = GLOBAL_SCOPE
MODULE_BUNNY_LANG.vars["list"] = new Var("bunny.lang", "list", function() {return new List(Array.from(arguments))})

function char_seq(s) {
    return s.split("").map(ch=>ch.charCodeAt(0))
}

function char_code(s) {
    return s.charCodeAt(0)
}

let ch_0 = "0".charCodeAt(0)
let ch_9 = "9".charCodeAt(0)
let ch_a = "a".charCodeAt(0)
let ch_z = "z".charCodeAt(0)
let ch_A = "A".charCodeAt(0)
let ch_Z = "Z".charCodeAt(0)
let ch_dubquot = "\"".charCodeAt(0)
let ch_quot = "'".charCodeAt(0)
let ch_lparen = "(".charCodeAt(0)
let ch_rparen = ")".charCodeAt(0)
let ch_slash = "/".charCodeAt(0)
let ch_backslash = "\\".charCodeAt(0)
let whitespace_chars = char_seq(" \r\n\t\v")
let sym_chars = char_seq("+-_|!?$<>.*%")

class StringReader {
    constructor(input) {
        this.input = input
        this.pos = 0
        this.limit = input.length
        this.line = 0
        this.col = 0
        this.ch = this.input[this.pos]
        this.cc = this.input.charCodeAt(this.pos)
    }

    eof() {
        return this.limit <= this.pos
    }

    next_ch() {
        if (this.eof()) return
        this.pos++
        this.col++
        this.ch = this.input[this.pos]
        this.cc = this.input.charCodeAt(this.pos)
    }

    skip_ws() {
        if (this.eof()) return
        while (whitespace_chars.includes(this.cc)) {
            if (this.cc == 10) {
                this.line++
                this.col = 0
            }
            this.next_ch()
        }
    }

    _read() {
        this.skip_ws()
        if (this.eof()) {
            return null
        } else if ((ch_a <= this.cc && this.cc <= ch_z)
                   || (ch_A <= this.cc && this.cc <= ch_Z)
                   || sym_chars.includes(this.cc)) {
            return this.read_symbol()
        } else if (ch_0 <= this.cc && this.cc <= ch_9) {
            return this.read_number()
        } else if (this.cc == ch_lparen) {
            return this.read_list()
        } else if (this.cc == ch_dubquot) {
            return this.read_string()
        } else if (this.cc == ch_quot) {
            this.next_ch()
            return new List([new Sym(null, "quote"), this.read()])
        }
        return "not recognized " + this.ch + " @" + this.pos
    }

    read() {
        let start = this.pos
        let col = this.col
        let line = this.line

        let expr = this._read()
        expr.start = start
        expr.end = this.pos
        expr.col = col
        expr.line = line

        return expr
    }

    read_number() {
        let start = this.pos
        while (!this.eof() && (ch_0 <= this.cc && this.cc <= ch_9)) this.next_ch()
        let num_str = this.input.substring(start, this.pos)
        return new Number(num_str, parseInt(num_str, 10))
    }

    read_string() {
        let start = this.pos
        this.next_ch()
        while (!this.eof() && ch_dubquot != this.cc) {
            this.next_ch()
            if (ch_backslash == this.cc) {
                this.next_ch()
            }
        }
        this.next_ch()
        let str = this.input.substring(start, this.pos)
        // FIXME: extremely naive and hacky implementation
        return new String(str, eval(str))
    }

    read_symbol() {
        let start = this.pos
        var name_start = this.pos
        var namespace = null
        while (!this.eof() &&
               (ch_a <= this.cc && this.cc <= ch_z ||
                ch_A <= this.cc && this.cc <= ch_Z ||
                ch_slash == this.cc ||
                sym_chars.includes(this.cc))) {
            if (ch_slash == this.cc) {
                namespace = this.input.substring(start, this.pos)
                name_start = this.pos+1
            }
            this.next_ch()
        }
        return new Sym(namespace, this.input.substring(name_start, this.pos))
    }

    read_list() {
        this.next_ch()
        let elements = []
        while (!this.eof() && !(this.cc == ch_rparen)) {
            elements[elements.length] = this.read()
        }
        this.next_ch()
        return new List(elements)
    }
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

function string_literal_estree(s) {
    return {type: "Literal", value: s, raw: JSON.stringify(s)}
}

function identifier_estree(i) {
    return {type: "Identifier", name: i}
}

function global_lookup_estree(elements) {
    return elements.reduce((acc,el)=>{
        return {type: 'MemberExpression',
                object: acc,
                property: (el.type ? el : {type: "Identifier", name: el.name}),
                computed: el.computed || false}},
                           {type: "Identifier", name: GLOBAL_SCOPE.deref()},)
}

function method_call_estree(callee, method, args) {
    return {type: "CallExpression",
            callee: {type: "MemberExpression",
                     object: callee,
                     property: identifier_estree(method)},
            arguments: args}
}

function module_lookup_estree(module_name) {
    return {type: "MemberExpression",
            object: global_lookup_estree([{name: "bunny"}, {name: "modules"}]),
            property: string_literal(module_name),
            computed: true}
}

function var_lookup_estree(module_name, var_name) {
    return method_call_estree(
        method_call_estree(module_lookup_estree(module_name),
                           "get_var",
                    [string_literal_estree(var_name)]),
        "deref",
        [])
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
        return var_lookup_estree(mod_name, this.var.name)
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
                          property: identifier_estree(this.method_name),
                          computed: false},
                arguments: this.args.map(a=>a.estree())}
    }
}


function string_literal(s) {
    return {type: "Literal", value: s, raw: JSON.stringify(s)}
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
        return {type: "CallExpression",
                callee: member_lookup([{type: "Identifier", name: GLOBAL_SCOPE.deref()},
                                       {type: "CallExpression",
                                        callee: member_lookup([{type: "MemberExpression",
                                                                object: member_lookup([{type: "Identifier", name: "bunny"},
                                                                                       {type: "Identifier", name: "modules"},]),
                                                                property: string_literal(CURRENT_MODULE.deref().name),
                                                                computed: true},
                                                               {type: "Identifier", name: "get_var"}]),
                                        arguments: [string_literal(this.var_name)]},
                                       {type: "Identifier", name: "set_value"}]),
                arguments: [this.value.estree()]}
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

let specials = {"fn*": FnExpr,
                "def": DefExpr}

class Analyzer {
    constructor() {
        this.locals_stack = []
    }
    analyze(form) {
        if (form instanceof List) {
            let initial = form.first()
            if (initial instanceof Sym && initial.namespace == null) {
                var expr_class;
                if (expr_class = specials[initial.name]) {
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

function init_runtime(global, global_identifier) {
    global.bunny = {}
    global.bunny.modules = {}
    global.bunny.modules['user'] = MODULE_USER
    global.bunny.modules['bunny.lang'] = MODULE_BUNNY_LANG
    GLOBAL_SCOPE.set_value(global_identifier)
}

function read_string(s) {
    return new StringReader(s).read()
}

function analyze(form) {
    return new Analyzer().analyze(form)
}

function emit_expr(expr) {
    return expr.estree()
}

function emit(form) {
    return emit_expr(analyze(form))
}

export {read_string, analyze, emit_expr, emit, init_runtime}
