import * as astring from 'astring'
import {Parser} from 'acorn'
const path = 'node:' + 'process'
const process = await import(path)


console.dir(Parser.parse('(async function() {return await 1+1})()', {allowAwaitOutsideFunction: true, ecmaVersion: 8}).body[0], {depth: null})

process.stdout.write("hello")
