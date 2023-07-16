// Copyright (c) Arne Brasseur 2023. All rights reserved.

import process, {stdin, stdout} from 'node:process'
import {isatty} from 'node:tty'
import {readFileSync} from "node:fs"
import {createRequire} from "node:module"

import * as astring from 'astring'

import {resolve, println, prn, symbol, intern, inspect} from "../lang.mjs"
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
        const mod = resolve(symbol("piglet:lang:*current-module*")).deref()
        stdout.write(mod.fqn.toString())
        stdout.write("=> ")
    }

    eval(data) {
        try {
            const input = data.toString().trim()
            this.reader.append(input)
            while (!this.reader.eof()) {
                try {
                    let form = this.reader.read()
                    // deal with someone putting a falsy literal directly into the REPL
                    if (form || input == "nil" || input == "undefined" || input == "false") {
                        let result = this.compiler.eval(form)
                        result.then((v)=>{
                            prn(v)
                            intern(symbol("*3"), resolve(symbol("*2"))?.deref())
                            intern(symbol("*2"), resolve(symbol("*1"))?.deref())
                            intern(symbol("*1"), v)
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
        stdin.on('end', ()=>process.exit())
    }
}
