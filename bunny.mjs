import * as astring from 'astring'
import {Parser} from 'acorn'

function str_hash_code(s) {
    for(var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
}

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

    hashCode() {
        return str_hash_code(this.namespace) + str_hash_code(this.name)
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

class List {
    constructor(elements) {
        this.elements = elements
    }

    repr() {
        return "(" + this.elements.map(e=>e.repr()).join(" ") + ")"
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

    [Symbol.iterator]() {
        return this.elements[Symbol.iterator]()
    }
}


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
let ch_lparen = "(".charCodeAt(0)
let ch_rparen = ")".charCodeAt(0)
let ch_slash = "/".charCodeAt(0)
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

class HostVarExpr {
    constructor(sym) {
        this.var = sym
    }
    static from(sym) {
        return new HostVarExpr(new Sym(null, sym.name))
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
            return ids.reduce((acc,id)=>{
                return {type: 'MemberExpression',
                        start: acc.start,
                        end: id.end,
                        object: acc,
                        property: id,
                        computed: false}
            })
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
        return {type: 'Identifier', name: this.var.name, start: this.var.start, end: this.var.end}
    }
}

class MethodExpr {
    constructor(form, method, object, args) {
        this.form = form
        this.method = method
        this.object = object
        this.args = args
    }

    static from(form, analyzer) {
        let iter = form[Symbol.iterator]()
        let method_name = iter.next().value
        let method = analyzer.analyze(new Sym(null, method_name.name.substr(1)))
        let object  = analyzer.analyze(iter.next().value)
        let args = Array.from(iter, f=>analyzer.analyze(f))
        return new MethodExpr(form, method, object, args)
    }
    estree() {
        console.log(this.args)
        return {
            type: 'CallExpression',
            start: this.form.start,
            end: this.form.end,
            callee:  {
                type: 'MemberExpression',
                start: this.form.start,
                end: this.form.edn,
                object: this.object.estree(),
                property: this.method.estree(),
                computed: false
            },
            arguments: this.args.map(a=>a.estree())
        }}
}

let specials = {"fn*": FnExpr}

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

function compile(form) {
}

// Set example code
var code = '(function(x) {})'
// Parse it into an AST
var ast = Parser.parse(code, { ecmaVersion: 6 })
// Format it into a code string
var formattedCode = astring.generate(ast)
// Check it
// console.log(ast)
// console.log(formattedCode)

// console.log(new StringReader("(js/+ 123 456)").read())
// console.log(new StringReader("(js/+ 123 456)").read().repr())
// console.log(new StringReader(".toString").read().repr())
// console.log(eval(astring.generate(new Analyzer().analyze(new StringReader("((fn* (a b) b) 1 2)").read()).estree())))
// console.log(new Analyzer().analyze(new StringReader("(.toString ((fn* (a b) b) 1 2))").read()).estree())
// console.log(astring.generate({type: "ExpressionStatement", expression:new Analyzer().analyze(new StringReader("(.toString ((fn* (a b) b) 1 20) 16)").read()).estree()}))
console.dir(new StringReader("(.toString ((fn* (a b) b) 1 20) 16)").read(), {depth: null})
console.log(eval(astring.generate(new Analyzer().analyze(new StringReader("(.toString ((fn* (a b) b) 1 20) 16)").read()).estree())))
// console.log(new Analyzer().analyze(new StringReader("(.toString ((fn* (a b) b) 1 2))").read()).estree())

code = 'foo.bar()'
code = '((function (a, b) {return b;})(1, 2)).toString()'

// console.dir(Parser.parse(code, { ecmaVersion: 6 }).body[0], {depth: null})

var done = (function wait () { if (!done) setTimeout(wait, 1000) })();
