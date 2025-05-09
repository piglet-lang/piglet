#!/usr/bin/env node

// Copyright (c) Arne Brasseur 2023. All rights reserved.

// Bootstrap piglet, then launch the "pig" CLI tool

import * as process from "node:process"
import * as url from "node:url"
import * as path from "node:path"
import NodeCompiler from "./NodeCompiler.mjs"
import {intern, symbol, qsym, module_registry} from "../lang.mjs"
import {PIGLET_PKG} from "../lang/util.mjs"

global.$piglet$ = module_registry.index

const compiler = new NodeCompiler()

const PIGLET_PACKAGE_PATH = path.join(url.fileURLToPath(import.meta.url), "../../../../packages/piglet")
await compiler.load_package(PIGLET_PACKAGE_PATH);
intern(symbol('piglet:lang:*compiler*'), compiler)
intern(symbol('piglet:lang:*verbosity*'), 0)

await compiler.load(qsym(`${PIGLET_PKG}:lang`))
await compiler.load(qsym(`${PIGLET_PKG}:node/pig-cli`))
