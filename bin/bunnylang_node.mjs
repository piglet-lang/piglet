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
import {println, module_registry, prefix_name, resolve, symbol} from "../lib/bunny/lang.mjs"
import bunny$$lang from "../lib/bunny/lang.mjs"
import NodeCompiler from "../lib/bunny/node/NodeCompiler.mjs"


process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

const cg = new CodeGen()
const analyzer = new Analyzer()
const reader = new StringReader("")
const compiler = new NodeCompiler()

global.$bunny$ = module_registry.packages
global.import = createRequire(import.meta.url)
await compiler.load(prefix_name("bunny", "lang"))

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

function write_prompt() {
    stdout.write("#_")
    const mod = resolve(symbol("bunny:lang:*current-module*")).deref()
    stdout.write(mod.pkg + ":" + mod.name)
    stdout.write("=>")
}

function eval_bunny(data) {
    try {
        reader.append(data.toString())
        while (!reader.eof()) {
            try {
                let form = reader.read()
                if (form) {
                    if (trace) {
                        println("--- form ------------")
                        println(form)
                    }
                    const ast = analyzer.analyze(form)
                    if (trace) {
                        println("--- AST -------------")
                        console.dir(ast, {depth: null})
                    }
                    let estree = cg.wrap_async_iife(ast, ast.emit(cg))
                    if (trace) {
                        println("--- estree ----------")
                        console.dir(estree, {depth: null})
                    }
                    let js = astring.generate(estree)
                    if (trace) {
                        println("--- js --------------")
                        println(js)
                    }
                    if (repl_mode) {
                        let result = eval(js)
                        if (trace) {
                            println("--- result-----------")
                        }
                        result.then((v)=>{println(v)
                                          write_prompt()
                                          reader.truncate()
                                         })
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
    if (repl_mode) write_prompt()
    stdin.on('data', eval_bunny)
}
