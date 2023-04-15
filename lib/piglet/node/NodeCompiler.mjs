// Copyright (c) Arne Brasseur 2023. All rights reserved.

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {readFileSync, existsSync} from "node:fs"
import * as path from "node:path"
import * as astring from 'astring'

import {module_registry} from "../lang.mjs"
global.$piglet$ = module_registry.modules

export default class NodeCompiler extends AbstractCompiler {
    constructor() {
        super()
        this.packages = {
            localpkg: {load_path: ["src", "demo"]},
            piglet: {load_path: ["packages/piglet/src"]}
        }
    }

    async slurp_mod(pkg, mod_name) {
        for (let dir of this.packages[pkg].load_path) {
            const mod_path = path.join(dir, mod_name + ".pig")
            if (existsSync(mod_path)) {
                return readFileSync(mod_path)
            }
        }
        throw new Error("Module not found: " + mod_name + " in " + pkg + "("  + JSON.stringify(this.packages[pkg]) + ")")
    }

    estree_to_js(estree) {
        return astring.generate(estree)
    }
}
