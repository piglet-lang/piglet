// Copyright (c) Arne Brasseur 2023. All rights reserved.

import * as astring from "/node_modules/astring/dist/astring.mjs"

window.astring = astring
console.log(astring)

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {module_registry} from "../lang.mjs"

export default class BrowserCompiler extends AbstractCompiler {
    constructor(base_url) {
        super()
        this.base_url = base_url
    }

    async slurp(path) {
        const response = await fetch(path)
        return await response.text()
    }

    async slurp_mod(pkg, mod_name) {
        const response = await fetch(`/packages/${pkg}/src/${mod_name}.pig`)
        return await response.text()
    }

    estree_to_js(estree) {
        return astring.generate(estree)
    }
}
