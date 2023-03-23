import * as astring from 'astring'
import {Parser} from 'acorn'
import CodeGen from './bunny/lang/CodeGen.mjs'
import * as bunny from './bunny/lang.mjs'
import * as runtime from './bunny/lang/runtime.mjs'
import {get_module} from './bunny/lang/runtime.mjs'

function compile(form) {
    return astring.generate(bunny.emit(form))
}

function compile_string(s) {
    return compile(bunny.read_string(s))
}

function eval_form(form) {
    return eval(compile(form))
}

function eval_string(s) {
    return eval(compile_string(s))
}

bunny.init_runtime(global, 'global')

// var code = '(def x 1)'
// var code2 = '(.toString (= \'(1) (list 1)))'
// console.dir(bunny.read_string(code), {depth: null})
// console.dir(bunny.read_string(code2), {depth: null})
// console.dir(bunny.analyze(bunny.read_string(code)), {depth: null})
// console.dir(bunny.analyze(bunny.read_string(code2)), {depth: null})
// console.dir(bunny.emit(bunny.read_string(code)), {depth: null})
// console.dir(compile_string(code), {depth: null})
// console.log(eval_string(code))
// console.log(eval_string(code2))
// console.log(eval_string('((fn* (a b) (+ a b)) 5 6)'))

// eval('global.xxx = {}')
// eval('global.xxx.yyy = 999')
// let code   = '((fn* (a b) (+ a b)) foo.bar/baz 4)'
// let code   = '(def today (.toString (js/Date)))'
// let code   = '(def today \'(1 2 3))'
let code   = '(if (== 3 4) "ok" "nok")'

let form   = bunny.read_string(code)
let ast    = bunny.analyze(form)
console.dir(ast, {depth: null})
let estree = ast.emit(new CodeGen(runtime,get_module("user")))
// console.dir(estree, {depth: null})
let es     = astring.generate(estree)
// console.dir(es, {depth: null})
console.dir(eval(es), {depth: null})
// console.dir(global.bunny.modules, {depth: null})
// console.dir(read_string("\"foo\""), {depth: null})
// console.log(compile_string("(js/parseInt (.toString 30) 16)"))
// console.log(eval_string("(js/parseInt (.toString 30) 16)"))

// console.dir(Parser.parse('(function () {})', {ecmaVersion: 6}).body[0], {depth: null})

// export {compile, compile_string, eval_form, eval_string}
