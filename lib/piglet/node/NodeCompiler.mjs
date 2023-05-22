// Copyright (c) Arne Brasseur 2023. All rights reserved.

import * as path from "node:path"
import * as fs from "node:fs"
import * as url from "node:url"

import * as astring from "astring"

import AbstractCompiler from "../lang/AbstractCompiler.mjs"
import {module_registry, deref, resolve, symbol, qsym, qname, read_string, assoc} from "../lang.mjs"
import {PIGLET_PKG} from "../lang/util.mjs"
import PrefixName from "../lang/PrefixName.mjs"

const piglet_home = url.fileURLToPath(new URL("../../..", import.meta.url))
const current_context = resolve(symbol('piglet:lang:*current-context*'))
const pkg$name = qname('https://vocab.piglet-lang.org/package/name')
const pkg$deps = qname('https://vocab.piglet-lang.org/package/deps')
const pkg$location = qname('https://vocab.piglet-lang.org/package/location')
const pkg$paths = qname('https://vocab.piglet-lang.org/package/location')

export default class NodeCompiler extends AbstractCompiler {
    constructor() {
        super()
    }

    async slurp(path) {
        return fs.readFileSync(path).toString()
    }

    async slurp_mod(pkg_name, mod_name) {
        const pkg = module_registry.find_package(pkg_name)
        if (!pkg) {
            throw new Error(`No such package present: ${pkg_name}`)
        }
        console.log(pkg)
        for (let dir of pkg.paths) {
            const mod_path = url.fileURLToPath(new URL(`${mod_name}.pig`, new URL(`${dir}/`, `${pkg.location}/`)))
            if (fs.existsSync(mod_path)) {
                return [fs.readFileSync(mod_path), mod_path]
            }
        }
        throw new Error(`Module not found: ${mod_name} in ${pkg}`)
    }

    resolve_js_path(path) {
        const mod = deref(resolve(symbol("piglet:lang:*current-module*")))
        return new URL(path, `${url.pathToFileURL(mod.location)}/../`).href
    }

    estree_to_js(estree) {
        return astring.generate(estree)
    }

    async load_package(location) {
        console.log(`load_package(${location})`)
        const package_pig_loc = path.join(location, "package.pig")
        if (fs.existsSync(package_pig_loc)) {
            let package_pig = this.expand_qnames(read_string(await this.slurp(package_pig_loc)))
            return this.register_package(qsym(url.pathToFileURL(location).href), package_pig)
        } else {
            console.log(`WARN: no package.pig found at ${package_pig_loc}`)
        }
    }
}
