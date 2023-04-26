// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Module from "./Module.mjs"
import PrefixName from "./PrefixName.mjs"
import piglet_lang, {ensure_module, symbol, resolve, print_str} from "../lang.mjs"
import {assert, assert_type} from "./util.mjs"
import {meta} from "./metadata.mjs"

export default class AbstractCompiler {
    constructor(opts) {
        this.opts = opts
        this.analyzer = new Analyzer()
        this.code_gen = new CodeGen()
        // const emit = this.code_gen.emit
        // this.code_gen.emit = (n,a)=>{console.log("\nEMITTING"); print_ast(0, n); return emit.call(this.code_gen, n, a)}
    }

    async slurp(path) {
        throw new Error("Not implemented")
    }

    async slurp_mod(pkg, mod) {
        throw new Error("Not implemented")
    }

    estree_to_js(estree) {
        throw new Error("not implemented")
    }

    async require(mod) {
        // console.log(`Compiler::require ${mod.inspect()}`)
        assert_type(mod, PrefixName)
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
        const pkg = mod.prefix ? mod.prefix : prev_mod.pkg
        const mod_name = mod.suffix
        if (!ensure_module(pkg, mod_name)?.required) {
            return await this.load(mod)
        }
        return false
    }

    async eval_string(source) {
        const r = new StringReader(source)

        const self = this
        const read_and_eval = async function () {
            if (!r.eof()) {
                let form = r.read()
                if (form) {
                    await self.eval(form)
                    await read_and_eval()
                }
            }
        }
        return await read_and_eval()
    }

    async load_file(path) {
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
        const source = await this.slurp(path)
        await this.eval_string(source.toString())
        resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod)
        resolve(symbol("piglet", "lang", "*current-context*")).set_value(prev_mod.context)
    }

    async load(mod) {
        // console.log("Compiler::loading", mod.toString())
        assert_type(mod, PrefixName)
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
        const pkg = mod.prefix ? mod.prefix : prev_mod.pkg
        this.pkg = pkg
        const mod_name = mod.suffix

        const source = await this.slurp_mod(pkg, mod_name)
        await this.eval_string(source.toString())
        // console.log(`Restoring *current-module* to ${prev_mod.inspect()}`)
        resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod)
        resolve(symbol("piglet", "lang", "*current-context*")).set_value(prev_mod.context)
        this.pkg = resolve(symbol("piglet", "lang", "*current-module*")).deref().pkg
        return mod.name
    }

    async eval(form) {
        const ast = this.analyzer.analyze(form)
        // print_ast(0, ast)
        let estree = ast.emit(this.code_gen)
        // console.dir(estree, {depth: null})
        estree = this.code_gen.wrap_async_iife(ast, estree)
        let js = this.estree_to_js(estree)
        // console.log(js)
        return await eval(js)
    }
}

// import {stdout} from 'node:process'
// const write = (s)=>stdout.write(s)

// function print_ast(depth, ast) {
//     const indent = (d)=>{for (let i =0 ; i < (d||depth);i++) { stdout.write(' ')}}
//     if (ast && ast?.inspect) {
//         write(ast.inspect())
//     } else if (Array.isArray(ast)) {
//         write("[\n")
//         for (let el of ast) {
//             indent(depth+2)
//             print_ast(depth+2, el)
//             write(",\n")
//         }
//         indent()
//         write("]")
//     } else if (ast && (typeof ast == 'object')) {
//         let type = ast?.constructor?.name
//         if(type) write(`${type} `)
//         write("{\n")
//         for (let [k, v] of ast instanceof Map ? ast.entries() : Object.entries(ast)) {
//             if (k === 'form' && Object.keys(ast).length != 1) {continue}
//             indent(depth+2)
//             write(k.toString())
//             write(': ')
//             if (v && v?.inspect) {
//                 write(v.inspect())
//                 write(",")
//                 write("\n")
//             } else if (v && (Array.isArray(v) || (typeof v == 'object'))) {
//                 print_ast(depth+2, v)
//                 write(",")
//                 write("\n")
//             } else {
//                 write('#js ')
//                 write(JSON.stringify(v)||`${ast}`)
//                 write(",\n")
//             }
//         }
//         indent()
//         write('}')
//     } else {
//         write('#js ')
//         write(JSON.stringify(ast)||`${ast}`)
//     }
// }
