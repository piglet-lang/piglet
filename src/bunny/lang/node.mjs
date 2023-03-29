// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Module from "./Module.mjs"
import Sym from "./Sym.mjs"
import {readFileSync} from 'node:fs'
import * as astring from 'astring'
import {ensure_module, find_module, module_registry, resolve, symbol} from "../lang.mjs"
import bunny$$lang from "../lang.mjs"

function load(file) {
    const source = readFileSync(file).toString()
    const r = new StringReader(source)
    const module_form = r.read()
    bunny$$lang.intern("*current-module*", ensure_module(module_form))
    const cg = new CodeGen()
    const analyzer = new Analyzer()
    //r.reset()
    let result = null
    while (!r.eof()) {
        let form = r.read()
        if (form) {
            let js = astring.generate(analyzer.analyze(form).emit(cg))
            console.log(js)
            result = eval(js)
        }
    }
    return result
}

global.$bunny$ = module_registry
load(process.argv[2])
