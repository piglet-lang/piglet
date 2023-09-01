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
        stdout.write(mod.fqn.toString().replace("https://piglet-lang.org/packages/", ""))
        stdout.write("=> ")
    }

    eval_more() {
        let start_pos = this.reader.pos
        try {
            let form = this.reader.read()
            let result = this.compiler.eval(form)
            return result.then((v)=>{
                prn(v)
                intern(symbol("*3"), resolve(symbol("*2"))?.deref())
                intern(symbol("*2"), resolve(symbol("*1"))?.deref())
                intern(symbol("*1"), v)
                try {this.reader.skip_ws()} catch (_) {}
                this.reader.truncate()
                if (!this.reader.eof()) {
                    return this.eval_more()
                } else {
                    this.write_prompt()
                }
            }, (e)=> {
                intern(symbol("user:*e"), e)
                console.log(e)
                try {this.reader.skip_ws()} catch (_) {}
                this.reader.truncate()
                if (!this.reader.eof()) {
                    return this.eval_more()
                } else {
                    this.write_prompt()
                }
            })
        } catch (e)  {
            if (e instanceof PartialParse) {
                this.reader.pos = start_pos
            } else {
                intern(symbol("user:*e"), e)
                console.log(e)
                this.reader.empty()
                this.write_prompt()
            }
        }
    }

    eval(data) {
        try {
            const input = data.toString()
            this.reader.append(input)
            if (!this.reader.eof()) {
                this.eval_more()
            }
        } catch (e) {
            intern(symbol("user:*e"), e)
            console.log(e)
            this.reader.empty()
            this.write_prompt()
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
