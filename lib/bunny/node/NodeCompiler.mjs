// Copyright (c) Arne Brasseur 2023. All rights reserved.

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {readFileSync, existsSync} from "node:fs"
import * as path from "node:path"
import * as astring from 'astring'

import {module_registry} from "../lang.mjs"
global.$bunny$ = module_registry.modules

export default class NodeCompiler extends AbstractCompiler {
    constructor() {
        super()
        this.load_path = ["demo"]
    }

    async slurp_mod(mod_name) {
        for (let dir of this.load_path) {
            const mod_path = path.join(dir, mod_name+".bun")
            if (existsSync(mod_path)) {
                return readFileSync(mod_path)
            }
        }
        throw new Error("Module not found: " + mod_name + " in " + this.load_path)
    }

    estree_to_js(estree) {
        return astring.generate(estree)
    }
}
