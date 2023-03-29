import * as astring from 'astring'
import {Parser} from 'acorn'

console.dir(Parser.parse('{const x = 4; x}', {ecmaVersion: 6}).body[0], {depth: null})
