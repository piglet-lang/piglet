#!/usr/bin/env node

// Copyright (c) Arne Brasseur 2023. All rights reserved.

// Error.stackTraceLimit = Infinity;

import * as process from "node:process"
import * as fs from "node:fs"
import * as url from "node:url"
import * as path from "node:path"

import NodeCompiler from "./NodeCompiler.mjs"
import PrefixName from "../lang/PrefixName.mjs"
import {parseArgs} from "node:util"

import {read_string, intern, resolve, deref,
        symbol, keyword, prefix_name,
        qname, qsym, dict,
        module_registry} from "../lang.mjs"

import {PIGLET_PKG} from "../lang/util.mjs"

global.$piglet$ = module_registry.index

const {
    values: { verbose, import: imports, package: packages },
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
        package: {
            type: "string",
            multiple: true
        }
    },
    allowPositionals: true
});

const compiler = new NodeCompiler()
await compiler.load_package(path.join(url.fileURLToPath(import.meta.url), "../../../../packages/piglet"))
intern(symbol('piglet:lang:*compiler*'), compiler)
await compiler.load(qsym(`${PIGLET_PKG}:lang`))


if (fs.existsSync("./package.pig")) {
    const pkg = await compiler.load_package(".")
    compiler.set_current_package(pkg.name)
}

if (packages) {
    for (const p of packages) {
        await compiler.load_package(p)
    }
}

if (imports) {
    for (const m of imports) {
        await compiler.load(symbol(m))
    }
}


if (positionals.length > 0) {
    const file = positionals[0]
    await compiler.load_file(file)
} else {
    const NodeREPL = (await import("./NodeREPL.mjs")).default
    new NodeREPL(compiler, {verbosity: verbose?.length || 0}).start()
}
