// Copyright (c) Arne Brasseur 2023. All rights reserved.

import * as astring from "../../../node_modules/astring/dist/astring.mjs"

window.astring = astring
console.log(astring)

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {module_registry, resolve, deref, symbol} from "../lang.mjs"

function mod_path(pkg, mod_name) {
    return new URL(`/packages/${pkg}/src/${mod_name}.pig`, document.location).href
}

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
        const response = await fetch(mod_path(pkg, mod_name))
        return await response.text()
    }

    resolve_js_path(path) {
        const mod = deref(resolve(symbol("piglet:lang:*current-module*")))
        return new URL(path, mod_path(mod.pkg, mod.name)).href
    }

    estree_to_js(estree) {
        return astring.generate(estree)
    }
}
