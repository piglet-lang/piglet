import * as astring from 'astring'
import {Parser} from 'acorn'
import * as bunny from './bunny/lang.mjs'

function compile(form) {
    return astring.generate(bunny.emit(form))
}

function compile_string(s) {
    return compile(bunny.read_string(s))
}

function eval_form(form) {
    return eval(bunny.compile(form))
}

function eval_string(s) {
    return eval(compile_string(s))
}

bunny.init_runtime(global, 'global')

var code = '(def x 1)'
var code2 = '(.toString (list x x))'
// console.dir(bunny.read_string(code), {depth: null})
// console.dir(bunny.read_string(code2), {depth: null})
// console.dir(bunny.analyze(bunny.read_string(code)), {depth: null})
console.dir(bunny.analyze(bunny.read_string(code2)), {depth: null})
// console.dir(bunny.emit(bunny.read_string(code)), {depth: null})
// console.dir(compile_string(code), {depth: null})
console.log(eval_string(code))
console.log(eval_string(code2))
// console.dir(global.bunny.modules, {depth: null})
// console.dir(read_string("\"foo\""), {depth: null})
// console.log(compile_string("(js/parseInt (.toString 30) 16)"))
// console.log(eval_string("(js/parseInt (.toString 30) 16)"))

var code = '3 + 4'
// console.dir(Parser.parse(code, {ecmaVersion: 6}).body[0], {depth: null})

export {compile, compile_string, eval_form, eval_string}
