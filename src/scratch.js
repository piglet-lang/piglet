

function str_hash_code(s) {
    for(var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
}

    hashCode() {
        return str_hash_code(this.namespace) + str_hash_code(this.name)
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
//

code = 'foo.bar()'
code = '((function (a, b) {return b;})(1, 2)).toString()'

// console.dir(Parser.parse(code, { ecmaVersion: 6 }).body[0], {depth: null})

var done = (function wait () { if (!done) setTimeout(wait, 1000) })();

bunny.lang.eq = function(a, b) {
    var fn = _this["bunny.lang.Eq$eq$arity2"]
    if (!fn) {
        resolve(new Sym("bunny.lang", "Eq"))
        global.bunny.modules["bunny.lang"].get_var("Eq")
    }
    fn(a,b)
}

let Eq = define_protocol(
    new Sym("bunny.lang", "Eq"),
    [["eq", [[["this", "that"], "Check equality"]]]]
)

console.log(Eq)

extend_protocol(
    Eq,
    Sym,
    [["eq", 2,
      function(me, other) {
          return (other instanceof Sym) &&
              me.namespace === other.namespace &&
              me.name === other.name
      }]]
)

extend_protocol(
    Eq,
    "string",
    [["eq", 2,
      function(me, other) {
          return me === other
      }]]
)

console.log(resolve(new Sym("bunny.lang", "eq")).invoke([new Sym("z", "y"), new Sym("x", "y")]))
console.log(resolve(new Sym("bunny.lang", "eq")).invoke(["foo", "foo"]))
console.log(resolve(new Sym("bunny.lang", "eq")).invoke([true, false]))

// old bunny.lang


import StringReader from "./lang/StringReader.mjs"
import Analyzer from "./lang/Analyzer.mjs"
import CodeGen from "./lang/CodeGen.mjs"
import {get_module, init_runtime} from "./lang/runtime.mjs"
import * as runtime from './lang/runtime.mjs'

function read_string(s) {
    return new StringReader(s).read()
}

function analyze(form) {
    return new Analyzer().analyze(form)
}

// function emit_expr(expr) {
//     return expr.estree()
// }

function emit_expr(expr) {
    return expr.emit(new CodeGen(runtime, get_module('user')))
}

function emit(form) {
    return emit_expr(analyze(form))
}

export {read_string, analyze, emit_expr, emit, init_runtime}
