// Copyright (c) Arne Brasseur 2023. All rights reserved.

import * as path from "node:path"
import * as fs from "node:fs"
import * as url from "node:url"

import * as astring from "astring"

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {module_registry, deref, resolve, symbol, qname, read_string, expand_qnames} from "../lang.mjs"

const pkg$name = qname('https://vocab.piglet-lang.org/package/name')
const pkg$deps = qname('https://vocab.piglet-lang.org/package/deps')
const pkg$location = qname('https://vocab.piglet-lang.org/package/location')
const pkg$paths = qname('https://vocab.piglet-lang.org/package/location')

export default class NodeCompiler extends AbstractCompiler {
    async slurp(path) {
        return fs.readFileSync(path).toString()
    }

    async spit(path, content) {
        return fs.writeFileSync(path, content)
    }

    async slurp_mod(pkg_name, mod_name) {
        const pkg = module_registry.find_package(pkg_name)
        if (!pkg) {
            throw new Error(`No such package present: ${pkg_name}`)
        }
        for (let dir of pkg.paths) {
            const mod_path = url.fileURLToPath(new URL(`${mod_name}.pig`, new URL(`${dir}/`, `${pkg.location}/`)))
            if (fs.existsSync(mod_path)) {
                return [fs.readFileSync(mod_path), mod_path]
            }
        }
        throw new Error(`Module not found: ${mod_name} in ${pkg}`)
    }

    resolve_js_path(js_path) {
        if (js_path.startsWith("node:")) return js_path

        const mod = deref(resolve(symbol("piglet:lang:*current-module*")))
        let base_path = mod.location

        if (js_path.startsWith("./") || js_path.startsWith("../")) {
            return new URL(js_path, `${url.pathToFileURL(base_path)}/../`).href
        }

        // FIXME: handle "exports"
        while (true) {
            const module_path = path.join(base_path, "node_modules", js_path)
            if (fs.existsSync(module_path)) {
                const package_json = JSON.parse(fs.readFileSync(path.join(module_path, "package.json"), 'utf8'))
                // FIXME, hard coding some cases right now, we need to redo this
                // properly and fix the code duplication with dev-server
                let resolve_default = (o)=>typeof o === 'string'?o:o.default
                if (package_json.exports?.["."]?.import) {
                    return path.join(module_path, resolve_default(package_json.exports?.["."]?.import))
                }
                if (package_json.exports?.default) {
                    return path.join(module_path, package_json.exports?.default)
                }
                if (package_json.main) return path.join(module_path, package_json.main)
                return path.join(module_path, "index.js")
            }
            base_path = path.join(base_path, '..')
            if (base_path === "/") return null
        }
    }

    estree_to_js(estree) {
        if (this.source_map_generator) {
            return astring.generate(estree, {sourceMap: this.source_map_generator})
        }
        return astring.generate(estree)
    }

    async load_package(location) {
        const package_pig_loc = path.join(location, "package.pig")
        if (fs.existsSync(package_pig_loc)) {
            let package_pig = expand_qnames(read_string(await this.slurp(package_pig_loc)))
            return this.register_package(url.pathToFileURL(location).href, package_pig)
        } else {
            console.log(`WARN: no package.pig found at ${package_pig_loc}`)
        }
    }
}
