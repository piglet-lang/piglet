// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./lang/StringReader.mjs"
import Analyzer from "./lang/Analyzer.mjs"
import CodeGen from "./lang/CodeGen.mjs"
import {get_module, init_runtime} from "./lang/runtime.mjs"
import * as runtime from './lang/runtime.mjs'

function read_string(s) {
    return new StringReader(s).read()
}

function analyze(form) {
    return new Analyzer().analyze(form)
}

// function emit_expr(expr) {
//     return expr.estree()
// }

function emit_expr(expr) {
    return expr.emit(new CodeGen(runtime, get_module('user')))
}

function emit(form) {
    return emit_expr(analyze(form))
}

export {read_string, analyze, emit_expr, emit, init_runtime}
