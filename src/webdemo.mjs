//import * as astring from 'astring'
import * as bunny from './bunny/lang.mjs'

bunny.init_runtime(window, 'window')

var code = '(def x 1)'
var code2 = '(.toString (list x x))'
// console.dir(bunny.read_string(code), {depth: null})
// console.dir(bunny.read_string(code2), {depth: null})
// console.dir(bunny.analyze(bunny.read_string(code)), {depth: null})
console.log(bunny.analyze(bunny.read_string(code2)), {depth: null})
// console.dir(bunny.emit(bunny.read_string(code)), {depth: null})
// console.dir(compile_string(code), {depth: null})
// console.log(eval_string(code))
// console.log(eval_string(code2))
// console.dir(global.bunny.modules, {depth: null})
// console.dir(read_string("\"foo\""), {depth: null})
// console.log(compile_string("(js/parseInt (.toString 30) 16)"))
// console.log(eval_string("(js/parseInt (.toString 30) 16)"))
