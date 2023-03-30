#!/usr/bin/env node

import {stdin, stdout} from 'node:process'
import {isatty} from 'node:tty'
import {parseArgs} from "node:util"
import {readFileSync} from "node:fs"

import * as astring from 'astring'

import StringReader from "../src/bunny/lang/StringReader.mjs"
import Analyzer from "../src/bunny/lang/Analyzer.mjs"
import CodeGen from "../src/bunny/lang/CodeGen.mjs"
import {println, module_registry} from "../src/bunny/lang.mjs"
import bunny$$lang from "../src/bunny/lang.mjs"


const cg = new CodeGen()
const analyzer = new Analyzer()
const reader = new StringReader("")
global.$bunny$ = module_registry

const {
    values: { trace },
    positionals: positionals
} = parseArgs({
    options: {
        trace: {type: "boolean"},
    },
    allowPositionals: true
});

let repl_mode = false
let prompt = "#_> "

function eval_bunny(data) {
    reader.append(data.toString())
    while (!reader.eof()) {
        let form = reader.read()
        if (form) {
            let js = astring.generate(analyzer.analyze(form).emit(cg))
            if (trace) {
                println("--- form --------")
                println(form)
                println("--- js ----------")
                println(js)
                println("--- result-------")
            }
            let result = eval(js)
            if (repl_mode) {
                println(result)
                stdout.write(prompt)
            }
        }
    }
}

if (positionals[0]) {
    eval_bunny(readFileSync(positionals[0]))
} else {
    repl_mode = stdin.isTTY
    if (repl_mode) stdout.write(prompt)
    stdin.on('data', eval_bunny)
}
