import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Module from "./Module.mjs"
import Sym from "./Sym.mjs"
import {readFileSync} from 'node:fs'
import * as astring from 'astring'
import {ensure_module, find_module, module_registry, resolve, symbol, first, println} from "../lang.mjs"
import bunny$$lang from "../lang.mjs"

const rl = readline.createInterface({ input, output })
const cg = new CodeGen()
const analyzer = new Analyzer()
bunny$$lang.intern("*current-module*", ensure_module("user"))
global.$bunny$ = module_registry

while(true) {
    const source = await rl.question('> ')
    try {
        const r = new StringReader(source)
        while (!r.eof()) {
            let form = r.read()
            if (form) {
                let js = astring.generate(analyzer.analyze(form).emit(cg))
                console.log(js)
                println(eval(js))
            }
        }
    } catch (e) {
        console.log(e)
    }
}
