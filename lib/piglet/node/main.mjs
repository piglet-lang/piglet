#!/usr/bin/env node

// Copyright (c) Arne Brasseur 2023. All rights reserved.

Error.stackTraceLimit = Infinity;

import * as process from "node:process"
import * as fs from "node:fs"
import * as url from "node:url"
import * as path from "node:path"
import { createRequire } from 'node:module'

import NodeCompiler from "./NodeCompiler.mjs"
import PrefixName from "../lang/PrefixName.mjs"
import NodeREPL from "./NodeREPL.mjs"

import {read_string, intern, resolve, deref,
        symbol, keyword, prefix_name,
        qname, qsym, dict,
        module_registry} from "../lang.mjs"

import {PIGLET_PKG} from "../lang/util.mjs"

global.$piglet$ = module_registry.index

// Currently aiming for compatibility with Node.js 17+, hence no util.parseArgs

let verbosity = 0, evals = [], imports = [], packages = [], positionals = []

for (let idx = 2 ; idx < process.argv.length; idx++) {
    switch (process.argv[idx]) {
    case "-e":
    case "--eval":
        idx+=1
        evals.push(process.argv[idx])
        break;
    case "-i":
    case "--import":
        idx+=1
        imports.push(process.argv[idx])
        break;
    case "-p":
    case "--package":
        idx+=1
        packages.push(process.argv[idx])
        break;
    default:
        if (/-v+/.test(process.argv[idx])) {
            verbosity += process.argv[idx].length-1
            break;
        }
        positionals.push(process.argv[idx])
    }
}


// console.log({verbosity, evals, imports, packages, positionals})

const compiler = new NodeCompiler()
const PIGLET_PACKAGE_PATH = path.join(url.fileURLToPath(import.meta.url), "../../../../packages/piglet")
await compiler.load_package(PIGLET_PACKAGE_PATH);

intern(symbol('piglet:lang:*compiler*'), compiler)
await compiler.load(qsym(`${PIGLET_PKG}:lang`))

let local_pkg = null
if (fs.existsSync("./package.pig")) {
    const pkg = await compiler.load_package(".")
    local_pkg = pkg.name
    compiler.set_current_package(local_pkg)
}

if (packages) {
    for (const p of packages) {
        if (local_pkg) compiler.set_current_package(local_pkg)
        await compiler.load_package(p)
    }
}

if (imports) {
    for (const m of imports) {
        if (local_pkg) compiler.set_current_package(local_pkg)
        await compiler.load(symbol(m))
    }
}

if (evals.length > 0) {
    for (const e of evals) {
        console.log(e)
        await compiler.eval_string(e)
    }
}

if (positionals.length > 0) {
    const file = positionals[0]
    if (local_pkg) compiler.set_current_package(local_pkg)
    await compiler.load_file(path.resolve(process.cwd(), file))
}

intern(symbol('piglet:lang:*verbosity*'), verbosity)

if (positionals.length === 0 && evals.length === 0) {
    new NodeREPL(compiler, {verbosity}).start()
}
