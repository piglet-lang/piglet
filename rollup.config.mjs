import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'

import piglet from './rollup_piglet.mjs'

const browser = {output: {}, plugins: []}
const node    = {output: {}, plugins: []}
const lang    = {output: {}, plugins: []}

browser.onwarn = node.onwarn = (e, warn) => (e.code === 'EVAL') ? "" : warn(e)

browser.input       = 'lib/piglet/browser/main.mjs'
browser.output.file = 'dist/piglet.browser.mjs'
browser.plugins.push(nodeResolve(), terser({module: true, ecma: 2018}))

node.input                       = 'lib/piglet/node/main.mjs'
node.output.file                 = 'dist/piglet.node.mjs'
node.output.inlineDynamicImports = true
node.plugins.push(
    nodeResolve(),
    replace({
        values: {
            PIGLET_PACKAGE_PATH: 'path.join(createRequire(import.meta.url).resolve("piglet-lang"), "../../packages/piglet")'
        },
        preventAssignment: true
    }),
    terser({module: true, ecma: 2018})
)

// lang.input = 'lib/piglet/lang.mjs'
lang.input = 'packages/piglet/src/lang.pig'
lang.output.file = 'dist/lang.mjs'
lang.plugins.push(piglet(), terser({module: true, ecma: 2018}))

export default [lang] //[browser, node, lang]
