import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'

const browser = {output: {}, plugins: []}
const node    = {output: {}, plugins: []}
const lang    = {output: {}, plugins: [terser()]}

browser.onwarn = node.onwarn = (e, warn) => (e.code === 'EVAL') ? "" : warn(e)

browser.input                    = 'lib/piglet/browser/main.mjs'
browser.output.file              = 'dist/piglet.browser.mjs'
browser.plugins.push(nodeResolve(), terser())

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
    terser()
)

lang.input = 'lib/piglet/lang.mjs'
lang.output.file = 'dist/lang.mjs'
lang.plugins.push(terser())

export default [browser, node, lang]
