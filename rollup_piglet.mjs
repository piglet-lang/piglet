import {createFilter} from '@rollup/pluginutils'
import * as path from 'node:path'
import * as url from "node:url"
import {intern, symbol, qsym, module_registry} from "./lib/piglet/lang.mjs"
import {PIGLET_PKG} from "./lib/piglet/lang/util.mjs"

import NodeCompiler from './lib/piglet/node/NodeCompiler.mjs'

const compiler = new NodeCompiler()
global.$piglet$ = module_registry.index

const PIGLET_PACKAGE_PATH = path.join(url.fileURLToPath(import.meta.url), "../packages/piglet")
await compiler.load_package(PIGLET_PACKAGE_PATH);
intern(symbol('piglet:lang:*compiler*'), compiler)

export default function(options) {
    return {
        transform: async function(code, id) {
            let out = ""
            compiler.hooks.js = (s) => out+=(s+";")
            await compiler.load(qsym(`${PIGLET_PKG}:lang`))
            await compiler.load_file(id)
            return {
                code: out,
                map: {mappings: ''}
            };
        }
    }
}
