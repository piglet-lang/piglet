#!/usr/bin/env node

import process, {stdin, stdout} from 'node:process'
import {isatty} from 'node:tty'
import {parseArgs} from "node:util"
import {readFileSync} from "node:fs"
import {createRequire} from "node:module"

import * as astring from 'astring'

import StringReader, {PartialParse} from "../lib/bunny/lang/StringReader.mjs"
import Analyzer from "../lib/bunny/lang/Analyzer.mjs"
import CodeGen from "../lib/bunny/lang/CodeGen.mjs"
import {println, module_registry} from "../lib/bunny/lang.mjs"
import bunny$$lang from "../lib/bunny/lang.mjs"

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

const cg = new CodeGen()
const analyzer = new Analyzer()
const reader = new StringReader("")
global.$bunny$ = module_registry
global.import = createRequire(import.meta.url)

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
    try {
        reader.append(data.toString())
        while (!reader.eof()) {
            try {
                let form = reader.read()
                if (form) {
                    let estree = analyzer.analyze(form).emit(cg)
                    let js = astring.generate(estree)
                    if (trace) {
                        println("--- form ------------")
                        println(form)
                        println("--- estree ----------")
                        console.log(estree)
                        println("--- js --------------")
                        println(js)
                        println("--- result-----------")
                    }
                    if (repl_mode) {
                        let result = eval(js)
                        println(result)
                        stdout.write(prompt)
                        reader.truncate()
                    } else {
                        eval(js)
                    }
                }
            } catch (e) {
                if (repl_mode) {
                    if (e instanceof PartialParse) {
                        reader.reset()
                        console.log("resetting", reader)
                        throw e
                    } else {
                        console.log(e)
                    }
                } else {
                    throw e
                }
            }
        }
    } catch (e) {
        if (e instanceof PartialParse) {
        } else {
            console.log(e)
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
