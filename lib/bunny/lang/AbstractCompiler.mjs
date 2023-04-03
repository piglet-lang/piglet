// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Module from "./Module.mjs"
import bunny$$lang from "../lang.mjs"

const CURRENT_MODULE = bunny$$lang.resolve("*current-module*")


class AbstractCompiler {
    constructor(opts) {
        this.opts = opts
        this.analyzer = new Analyzer()
        this.code_gen = new CodeGen()
    }
    async slurp(path) {
        throw new Error("not implemented")
    }
    async load(path) {
        let source = await this.slurp(path)
        const r = new StringReader(source)
        const module_form = r.read()
        const module = Module.from(module_form)
        CURRENT_MODULE.set_value(ensure_module(module.name))

        let result = null
        while (!r.eof()) {
            let form = r.read()
            if (form) {
                let js = astring.generate(analyzer.analyze(form).emit(cg))
                result = eval(js)
            }
        }
        return result
    }

    async eval(form) {
        const ast = this.analyzer.analyze(form)
        let estree = cg.wrap_async_iife(ast, ast.emit(cg))
        let js = astring.generate(estree)
        return eval(js)
    }
}
