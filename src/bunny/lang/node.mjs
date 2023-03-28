// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Module from "./Module.mjs"
import {get_module, init_runtime, init_module} from "./runtime.mjs"
import * as runtime from './runtime.mjs'
import {readFileSync} from 'node:fs'
import * as astring from 'astring'

function load(file) {
    const source = readFileSync(file).toString()
    const r = new StringReader(source)
    const module_form = r.read()
    const mod = init_module(module_form)
    const cg = new CodeGen(runtime, mod)
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

init_runtime(global)
load(process.argv[2])
