import * as astring from 'astring'
import {Parser} from 'acorn'
const path = 'node:' + 'process'
const process = await import(path)


console.dir(Parser.parse('{const x = foo(); const y = bar(x); do_thing(x,y)}', {allowAwaitOutsideFunction: true, ecmaVersion: 8}).body[0], {depth: null})
console.dir(Parser.parse('{const [x,y] = foo()}', {allowAwaitOutsideFunction: true, ecmaVersion: 8}).body[0], {depth: null})
console.dir(Parser.parse('{const {x,y} = foo()}', {allowAwaitOutsideFunction: true, ecmaVersion: 8}).body[0], {depth: null})
console.dir(Parser.parse('{const {x: x_,y: y_} = foo()}', {allowAwaitOutsideFunction: true, ecmaVersion: 8}).body[0], {depth: null})
console.dir(Parser.parse('{const {x: x_ = 123,y: y_} = foo()}', {allowAwaitOutsideFunction: true, ecmaVersion: 8}).body[0], {depth: null})
