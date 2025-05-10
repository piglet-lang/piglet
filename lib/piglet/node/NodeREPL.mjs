// Copyright (c) Arne Brasseur 2023. All rights reserved.

import process, {stdin, stdout} from 'node:process'
import * as readline from 'node:readline'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as astring from 'astring'

import {resolve, println, prn, symbol, intern, inspect, string_reader} from "../lang.mjs"
import {PartialParse} from "../lang/StringReader.mjs"

export default class NodeREPL {
  constructor(compiler, opts) {
    this.compiler = compiler
    this.analyzer = compiler.analyzer
    this.code_gen = compiler.code_gen
    this.reader = string_reader("")
    this.verbosity = opts?.verbosity || 0
  }

  prompt() {
    const mod = resolve(symbol("piglet:lang:*current-module*")).deref()
    return `${mod.fqn.toString().replace("https://piglet-lang.org/packages/", "")}=> `
  }

  write_prompt() {
    stdout.write(this.prompt())
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

  start_readline() {
    process.on(
      'unhandledRejection',
      (reason, promise) => {
        // promise.then(null, (e)=> intern(symbol("user:*e", e)))
        console.log('Unhandled Rejection at:', promise, 'reason:', reason)
      }
    )

    const pigletDir = path.join(os.homedir(), '.local/piglet')
    const historyFile = path.join(pigletDir, 'repl_history')
    fs.mkdirSync(pigletDir, { recursive: true })
    if(!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, "")
    const history = fs.readFileSync(historyFile, 'utf-8').split('\n')

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.prompt(),
      history: history
    });

    rl.prompt()

    rl.on('line', (line) => {
      this.eval(line)
      rl.setPrompt(this.prompt())
    }).on('close', () => {
      fs.writeFileSync(historyFile, rl.history.join('\n'))
      console.log('\n\n\x1B[31m    n   n    ')
      console.log('   (・⚇・)/  \x1B[33mgoodbye!\x1B[31m')
      console.log('   ~(_ _)         \x1B[33m...oink\x1B[0m')
      process.exit(0);
    })
  }
}
