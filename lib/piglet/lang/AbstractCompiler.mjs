// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Module from "./Module.mjs"
import {PrefixName} from "./QName.mjs"
import piglet_lang, {ensure_module, symbol, resolve} from "../lang.mjs"
import {assert, assert_type} from "./util.mjs"

export default class AbstractCompiler {
    constructor(opts) {
        this.opts = opts
        this.analyzer = new Analyzer()
        this.code_gen = new CodeGen()
    }

    async slurp_mod(pkg, mod) {
        throw new Error("not implemented")
    }

    estree_to_js(estree) {
        throw new Error("not implemented")
    }

    async require(mod) {
        assert_type(mod, PrefixName)
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
        const pkg = mod.prefix ? mod.prefix : prev_mod.pkg
        const mod_name = mod.suffix
        if (!ensure_module(pkg, mod_name)?.required) {
            return await this.load(mod)
        }
        return false
    }

    async load(mod) {
        assert_type(mod, PrefixName)
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
        const pkg = mod.prefix ? mod.prefix : prev_mod.pkg
        this.pkg = pkg
        const mod_name = mod.suffix

        const source = await this.slurp_mod(pkg, mod_name)
        const r = new StringReader(source.toString())

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
        await read_and_eval()
        resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod)
        this.pkg = resolve(symbol("piglet", "lang", "*current-module*")).deref().pkg
        return mod.name
    }

    async eval(form) {
        const ast = this.analyzer.analyze(form)
        let estree = ast.emit(this.code_gen)
        estree = this.code_gen.wrap_async_iife(ast, estree)
        let js = this.estree_to_js(estree)
        console.log(js)
        return await eval(js)
    }
}
