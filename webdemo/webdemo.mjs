import * as astring from './astring.mjs'
import * as piglet from '../src/piglet/lang.mjs'
import StringReader from "../src/piglet/lang/StringReader.mjs"

function compile(form) {
    return astring.generate(piglet.emit(form))
}

function compile_string(s) {
    return compile(piglet.read_string(s))
}

function eval_form(form) {
    console.log(form)
    console.log(piglet.analyze(form))
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

piglet.init_runtime(window, 'window')

var code = '(def x 1)'
var code2 = '(.toString (list x x))'
// console.dir(piglet.read_string(code), {depth: null})
// console.dir(piglet.read_string(code2), {depth: null})
// console.dir(piglet.analyze(piglet.read_string(code)), {depth: null})
console.log(piglet.analyze(piglet.read_string(code2)), {depth: null})
// console.dir(piglet.emit(piglet.read_string(code)), {depth: null})
// console.dir(compile_string(code), {depth: null})
console.log(eval_string(code))
console.log(eval_string(code2))
// console.dir(global.piglet.modules, {depth: null})
// console.dir(read_string("\"foo\""), {depth: null})
// console.log(compile_string("(js/parseInt (.toString 30) 16)"))
// console.log(eval_string("(js/parseInt (.toString 30) 16)"))

eval_string(document.getElementById('my-script').innerText)
