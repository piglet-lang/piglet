import * as astring from 'astring'
import {Parser} from 'acorn'

console.dir(Parser.parse('await 1', {allowAwaitOutsideFunction: true, ecmaVersion: 8}).body[0], {depth: null})
