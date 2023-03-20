import * as astring from './astring.mjs'
import * as bunny from '../src/bunny/lang.mjs'
import StringReader from "../src/bunny/lang/StringReader.mjs"

function compile(form) {
    return astring.generate(bunny.emit(form))
}

function compile_string(s) {
    return compile(bunny.read_string(s))
}

function eval_form(form) {
    console.log(form)
    console.log(bunny.analyze(form))
    console.log(compile(form))
    return eval(compile(form))
}

function eval_string(s) {
    let r = new StringReader(s)
    var result = null
    while (!r.eof()) {
        var form = r.read()
        if (form) {
            result = eval_form(form)
        }
    }
    return result
}

bunny.init_runtime(window, 'window')

var code = '(def x 1)'
var code2 = '(.toString (list x x))'
// console.dir(bunny.read_string(code), {depth: null})
// console.dir(bunny.read_string(code2), {depth: null})
// console.dir(bunny.analyze(bunny.read_string(code)), {depth: null})
console.log(bunny.analyze(bunny.read_string(code2)), {depth: null})
// console.dir(bunny.emit(bunny.read_string(code)), {depth: null})
// console.dir(compile_string(code), {depth: null})
console.log(eval_string(code))
console.log(eval_string(code2))
// console.dir(global.bunny.modules, {depth: null})
// console.dir(read_string("\"foo\""), {depth: null})
// console.log(compile_string("(js/parseInt (.toString 30) 16)"))
// console.log(eval_string("(js/parseInt (.toString 30) 16)"))

eval_string(document.getElementById('my-script').innerText)
