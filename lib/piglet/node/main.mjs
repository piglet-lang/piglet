#!/usr/bin/env node

// Copyright (c) Arne Brasseur 2023. All rights reserved.

import NodeCompiler from "./NodeCompiler.mjs"
import {parseArgs} from "node:util"

import {intern, symbol, module_registry, prefix_name, qsym} from "../lang.mjs"
import {PIGLET_PKG} from "../lang/util.mjs"
global.$piglet$ = module_registry.packages

const {
    values: { verbose, import: imports },
    positionals: positionals
} = parseArgs({
    options: {
        verbose: {
            type: "boolean",
            short: "v",
            multiple: true
        },
        import: {
            type: "string",
            short: "i",
            multiple: true
        },
    },
    allowPositionals: true
});

const compiler = new NodeCompiler()
intern(symbol('piglet:lang:*compiler*'), compiler)
await compiler.load(qsym(`${PIGLET_PKG}:lang`))

if (imports) {
    for (const m of imports) {
        await compiler.load(m.includes(":") ? prefix_name(m) : prefix_name("localpkg", m))
    }
}

if (positionals.length > 0) {
    const file = positionals[0]
    await compiler.load_file(file)
} else {
    const NodeREPL = (await import("./NodeREPL.mjs")).default
    new NodeREPL(compiler, {verbosity: verbose?.length || 0}).start()
}
