// Copyright (c) Arne Brasseur 2023. All rights reserved.

import * as path from "node:path"
import * as fs from "node:fs"
import * as url from "node:url"

import * as astring from "astring"

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {module_registry} from "../lang.mjs"

const piglet_home = url.fileURLToPath(new URL("../../..", import.meta.url))

export default class NodeCompiler extends AbstractCompiler {
    constructor() {
        super()
        this.packages = {
            localpkg: {load_path: ["src", "demo"]},
            piglet: {load_path: [`${piglet_home}/packages/piglet/src`]},
            nrepl: {load_path: [`${piglet_home}/packages/nrepl/src`]}
        }
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

    estree_to_js(estree) {
        return astring.generate(estree)
    }
}
