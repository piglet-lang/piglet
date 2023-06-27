// Copyright (c) Arne Brasseur 2023. All rights reserved.

import * as astring from "astring"

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {module_registry, resolve, deref, symbol, read_string, expand_qnames} from "../lang.mjs"
import {assert} from "../lang/util.mjs"

export default class BrowserCompiler extends AbstractCompiler {
    async slurp(path) {
        const response = await fetch(path)
        return await response.text()
    }

    async slurp_mod(pkg_name, mod_name) {
        const pkg = module_registry.find_package(pkg_name)
        for (const dir of pkg.paths) {
            const location = new URL(`${mod_name}.pig`, new URL(`${dir}/`, new URL(pkg.location, window.location))).href
            const response = await fetch(location)
            if (response.ok) return [await response.text(), location]
        }
    }

    resolve_js_path(js_path) {
        const mod = deref(resolve(symbol("piglet:lang:*current-module*")))

        if (js_path.startsWith("./") || js_path.startsWith("../")) {
            return new URL(js_path, mod.location).href
        }
        return js_path
    }

    estree_to_js(estree) {
        if (window.sourceMap) {
            const mod = deref(resolve(symbol("piglet:lang:*current-module*")))
            const map = new sourceMap.SourceMapGenerator({
                file: mod.location
            })
            const code = astring.generate(estree, {sourceMap: map})

            return `${code}\n//# sourceURL=${mod.location}?line=${estree.line}\n//# sourceMappingURL=data:application/json;base64,${btoa(map.toString())}`
        }
        return astring.generate(estree)
    }

    async load_package(location) {
        assert(location)
        const package_pig_loc = new URL("package.pig", new URL(`${location}/`, window.location)).href
        const response = await fetch(package_pig_loc)
        if (response.ok) {
            console.log(response)
            let package_pig = expand_qnames(read_string(await response.text()))
            return this.register_package(package_pig_loc, package_pig)
        }
    }

}
