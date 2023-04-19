#!/usr/bin/env node

// Copyright (c) Arne Brasseur 2023. All rights reserved.

import NodeCompiler from "./NodeCompiler.mjs"
import {parseArgs} from "node:util"

import {intern, symbol, module_registry, prefix_name} from "../lang.mjs"
global.$piglet$ = module_registry.packages

const {
    values: { verbose },
    positionals: positionals
} = parseArgs({
    options: {
        verbose: {
            type: "boolean",
            short: "v",
            multiple: true
        },
    },
    allowPositionals: true
});

const compiler = new NodeCompiler()
intern(symbol("piglet:lang:*compiler*"), compiler)
await compiler.load(prefix_name("piglet", "lang"))

if (positionals.length > 0) {
    await compiler.load(prefix_name("localpkg", positionals[0]))
} else {
    const NodeREPL = (await import("./NodeREPL.mjs")).default
    new NodeREPL(compiler, {verbosity: verbose?.length || 0}).start()
}
