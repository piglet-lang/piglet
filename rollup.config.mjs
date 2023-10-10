import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'

const browser = {output: {}, plugins: [nodeResolve()]}
const node = {output: {}, plugins: [nodeResolve()]}

browser.onwarn = node.onwarn = (e, warn) => (e.code === 'EVAL') ? "" : warn(e)

browser.input                    = 'lib/piglet/browser/main.mjs'
browser.output.file              = 'dist/piglet.browser.mjs'

node.input                       = 'lib/piglet/node/main.mjs'
node.output.file                 = 'dist/piglet.node.mjs'
node.output.inlineDynamicImports = true

const node_replace = {
    values: {
        PIGLET_PACKAGE_PATH: 'path.join(createRequire(import.meta.url).resolve("piglet-lang"), "../../../packages/piglet")'
    },
    preventAssignment: true
}

browser.plugins.push(terser())

node.plugins.push(replace(node_replace))
node.plugins.push(terser())

export default [browser, node]
