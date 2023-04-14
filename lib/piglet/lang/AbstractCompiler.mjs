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

    async load(mod) {
        assert_type(mod, PrefixName)

        const pkg = mod.prefix ? mod.prefix : "localpkg"
        const mod_name = mod.suffix

        const source = await this.slurp_mod(pkg, mod_name)
        const r = new StringReader(source.toString())
        const module_form = r.read()
        const module = ensure_module(pkg, mod_name)
        const form_mod = Module.from(pkg, module_form)
        assert(module.name == form_mod.name)
        Object.assign(module.imports, form_mod.imports)
        Object.assign(module.aliases, form_mod.aliases)

        resolve(symbol("piglet", "lang", "*current-module*")).push_binding(module)

        if (!module.required) {
            for (let {from} of module.imports){
                await this.load(from)
            }
        }

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
        resolve(symbol("piglet", "lang", "*current-module*")).pop_binding()
        return module.name
    }

    async eval(form) {
        const ast = this.analyzer.analyze(form)
        let estree = ast.emit(this.code_gen)
        estree = this.code_gen.wrap_async_iife(ast, estree)
        let js = this.estree_to_js(estree)
        return await eval(js)
    }
}
