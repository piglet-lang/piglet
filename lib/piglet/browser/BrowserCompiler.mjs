// Copyright (c) Arne Brasseur 2023. All rights reserved.

import * as astring from "astring"

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {module_registry} from "../lang.mjs"

window.$piglet$ = module_registry.modules

export default class BrowserCompiler extends AbstractCompiler {
    constructor(base_url) {
        super()
        this.base_url = base_url
        this.packages = {
            localpkg: {location: },
            piglet: {load_path: []}
        }
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
