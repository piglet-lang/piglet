// Copyright (c) Arne Brasseur 2023. All rights reserved.

import * as path from "node:path"
import * as fs from "node:fs"
import * as url from "node:url"

import * as astring from "astring"

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {module_registry, deref, resolve, symbol} from "../lang.mjs"
import {PIGLET_PKG} from "../lang/util.mjs"

const piglet_home = url.fileURLToPath(new URL("../../..", import.meta.url))

export default class NodeCompiler extends AbstractCompiler {
    constructor() {
        super()
        this.packages = {
            localpkg: {load_path: ["src", "demo"]},
            piglet: {load_path: [`${piglet_home}/packages/piglet/src`]},
            pdp: {load_path: [`${piglet_home}/packages/pdp/src`]},
            nrepl: {load_path: [`${piglet_home}/packages/nrepl/src`]}
        }

        // transition to QSym
        this.packages[PIGLET_PKG]=this.packages['piglet']
    }

    async slurp(path) {
        return fs.readFileSync(path).toString()
    }

    async slurp_mod(pkg, mod_name) {
        for (let dir of this.packages[pkg].load_path) {
            const mod_path = path.join(dir, mod_name + ".pig")
            if (fs.existsSync(mod_path)) {
                return fs.readFileSync(mod_path)
            }
        }
        throw new Error(`Module not found: ${mod_name} in ${pkg} (${JSON.stringify(this.packages[pkg])})`)
    }

    resolve_js_path(path) {
        const mod = deref(resolve(symbol("piglet:lang:*current-module*")))
        return new URL(path, `${url.pathToFileURL(this.packages[mod.pkg].load_path[0])}/`).href
    }

    estree_to_js(estree) {
        return astring.generate(estree)
    }
}
