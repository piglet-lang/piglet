// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Module from "./Module.mjs"
import bunny_lang, {ensure_module, symbol, resolve} from "../lang.mjs"

export default class AbstractCompiler {
    constructor(opts) {
        this.opts = opts
        this.analyzer = new Analyzer()
        this.code_gen = new CodeGen()
    }

    async slurp_mod(mod_name) {
        throw new Error("not implemented")
    }

    estree_to_js(estree) {
        throw new Error("not implemented")
    }

    async load(mod_name) {
        const source = await this.slurp_mod(mod_name)
        const r = new StringReader(source.toString())
        const module_form = r.read()
        const module = Module.from(module_form)
        resolve(symbol("bunny:lang", "*current-module*")).set_value(ensure_module(module.name))

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
