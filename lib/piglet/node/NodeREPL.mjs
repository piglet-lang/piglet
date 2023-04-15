// Copyright (c) Arne Brasseur 2023. All rights reserved.

import process, {stdin, stdout} from 'node:process'
import {isatty} from 'node:tty'
import {readFileSync} from "node:fs"
import {createRequire} from "node:module"

import * as astring from 'astring'

import {resolve, println, prn, symbol, intern} from "../lang.mjs"
import StringReader, {PartialParse} from "../lang/StringReader.mjs"

export default class NodeREPL {
    constructor(compiler, opts) {
        this.compiler = compiler
        this.analyzer = compiler.analyzer
        this.code_gen = compiler.code_gen
        this.reader = new StringReader("")
        this.verbosity = opts?.verbosity || 0
    }
    write_prompt() {
        stdout.write("#_")
        const mod = resolve(symbol("piglet:lang:*current-module*")).deref()
        stdout.write(mod.pkg + ":" + mod.name)
        stdout.write("=> ")
    }

    eval(data) {
        try {
            this.reader.append(data.toString())
            while (!this.reader.eof()) {
                try {
                    let form = this.reader.read()
                    if (form) {
                        if (this.verbosity >= 2) {
                            println("--- form ------------")
                            println(form)
                        }
                        const ast = this.analyzer.analyze(form)
                        if (this.verbosity >= 3) {
                            println("--- AST -------------")
                            console.dir(ast, {depth: null})
                        }
                        let estree = this.code_gen.wrap_async_iife(ast, ast.emit(this.code_gen))
                        if (this.verbosity >= 4) {
                            println("--- estree ----------")
                            console.dir(estree, {depth: null})
                        }
                        let js = astring.generate(estree)
                        if (this.verbosity >= 1) {
                            println("--- js --------------")
                            println(js)
                        }
                        let result = eval(js)
                        if (this.verbosity >= 1) {
                            println("--- result-----------")
                        }
                        result.then((v)=>{prn(v)
                                          intern(symbol("user:*3"), resolve(symbol("user:*2"))?.deref())
                                          intern(symbol("user:*2"), resolve(symbol("user:*1"))?.deref())
                                          intern(symbol("user:*1"), v)
                                          this.write_prompt()
                                          this.reader.truncate()
                                         })
                    }
                } catch (e)  {
                    if (e instanceof PartialParse) {
                        this.reader.reset()
                        throw e
                    } else {
                        intern(symbol("user:*e"), e)
                        console.log(e)
                        this.reader.empty()
                        this.write_prompt()
                    }
                }
            }
        } catch (e) {
            if (e instanceof PartialParse) {
            } else {
                console.log(e)
                this.reader.empty()
                this.write_prompt()
            }
        }
    }
    start() {
        process.on(
            'unhandledRejection',
            (reason, promise) => {
                // promise.then(null, (e)=> intern(symbol("user:*e", e)))
                console.log('Unhandled Rejection at:', promise, 'reason:', reason)
            }
        )
        this.write_prompt()
        stdin.on('data', this.eval.bind(this))
    }
}
