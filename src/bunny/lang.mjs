// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./lang/Sym.mjs"
import Number from "./lang/Number.mjs"
import String from "./lang/String.mjs"
import List from "./lang/List.mjs"
import Var from "./lang/Var.mjs"
import Module from "./lang/Module.mjs"
import StringReader from "./lang/StringReader.mjs"
import Analyzer from "./lang/Analyzer.mjs"
import CodeGen from "./lang/CodeGen.mjs"
import {GLOBAL_SCOPE, CURRENT_MODULE, init_runtime} from "./lang/runtime.mjs"

function read_string(s) {
    return new StringReader(s).read()
}

function analyze(form) {
    return new Analyzer().analyze(form)
}

function emit_expr(expr) {
    return expr.estree()
}

function emit_expr2(expr) {
    return expr.emit(new CodeGen())
}

function emit(form) {
    return emit_expr(analyze(form))
}

export {read_string, analyze, emit_expr, emit, init_runtime}
