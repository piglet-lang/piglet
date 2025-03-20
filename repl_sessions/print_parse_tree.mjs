import * as astring from 'astring'
import {Parser} from 'acorn'

const path = 'node:' + 'process'
const process = await import(path)


// console.log(
//     Parser.extend(classFields).parse('class X { x = 0 }', {ecmaVersion: 2020})
// )

function print_parse_tree(... code) {
    for (let c of code) {
        console.log(c)
        console.dir(Parser.parse(c, {allowAwaitOutsideFunction: true, ecmaVersion: 2022}).body[0], {depth: null})
        console.dir(astring.generate(Parser.parse(c, {allowAwaitOutsideFunction: true, ecmaVersion: 2022}).body[0], {depth: null}))
    }
}

print_parse_tree(
    // '{const x = foo(); const y = bar(x); do_thing(x,y)}',
    // '{const [x,y] = foo()}',
    // '{const {x,y} = foo()}',
    // '{const {x: x_,y: y_} = foo()}',
    // '{const {x: x_ = 123,y: y_} = foo()}',
    // "const [x,y] = 1"
    // 'async function foo() { await impor("bar")}'
    //    '( function() { let x = {(123);}; return x })'
    // 'throw new Error("x")',
    // 'typeof x',
    // 'try {} catch (e) {} finally {}'
    // "aoo(await(bar.baz()))"
    "class xxx { foo = 123 }"
)
