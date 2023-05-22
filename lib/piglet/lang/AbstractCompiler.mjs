// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Context from "./Context.mjs"
import Module from "./Module.mjs"
import PrefixName from "./PrefixName.mjs"
import Sym from "./Sym.mjs"
import QSym from "./QSym.mjs"
import piglet_lang, {assoc, println, ensure_module, symbol, qname, resolve, deref, print_str, module_registry} from "../lang.mjs"
import {assert, assert_type} from "./util.mjs"
import {meta} from "./metadata.mjs"

const pkg$name = qname('https://vocab.piglet-lang.org/package/name')
const pkg$deps = qname('https://vocab.piglet-lang.org/package/deps')
const pkg$location = qname('https://vocab.piglet-lang.org/package/location')
const pkg$paths = qname('https://vocab.piglet-lang.org/package/location')

export default class AbstractCompiler {
    constructor(opts) {
        this.opts = opts
        this.analyzer = new Analyzer()
        this.code_gen = new CodeGen()
        // const emit = this.code_gen.emit
        // this.code_gen.emit = (n,a)=>{console.log("\nEMITTING"); print_ast(0, n); return emit.call(this.code_gen, n, a)}
    }

    async slurp(path) {
        throw new Error("Not implemented")
    }

    async slurp_mod(pkg, mod) {
        throw new Error("Not implemented")
    }

    estree_to_js(estree) {
        throw new Error("not implemented")
    }

    async require(mod) {
        // console.log(`Compiler::require ${mod.inspect()}`)
        assert_type(mod, QSym)
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
        const pkg = mod.prefix ? mod.prefix : prev_mod.pkg
        const mod_name = mod.suffix
        if (!ensure_module(mod.pkg, mod.name)?.required) {
            const loaded = await this.load(mod)
            console.log(loaded, typeof loaded)
            loaded.required = true
            return loaded
        }
        return false
    }

    async eval_string(source, filename) {
        const r = new StringReader(source, filename)

        const self = this
        const read_and_eval = async function () {
            if (!r.eof()) {
                let form = r.read()
                if (form) {
                    let result = await self.eval(form)
                    await read_and_eval()
                    return result
                }
            }
        }
        return await read_and_eval()
    }

    async load_file(path) {
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
        const source = await this.slurp(path)
        await this.eval_string(source.toString(), path)
        resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod)
        resolve(symbol("piglet", "lang", "*current-context*")).set_value(prev_mod.context)
    }

    resolve_js_path(path) {
        return path
    }

    set_current_package(pkg) {
        this.pkg = pkg //legacy
        resolve(symbol('piglet:lang:*current-package*')).set_value(module_registry.ensure_package(pkg))
    }

    async load(mod) {
        const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
        const current_package = resolve(symbol("piglet", "lang", "*current-package*")).deref()
        if(mod instanceof PrefixName) { // legacy
            console.log(`WARN: specifying modules with PrefixNames is deprecated, got ${mod}`,)
            this.set_current_package(mod.prefix ? mod.prefix : prev_mod.pkg)
            this.mod_name = mod.suffix
        }

        if(mod instanceof Sym) {
            if (mod.mod) {
                this.set_current_package(current_package.resolve_alias(mod.mod))
            }
            this.mod_name = mod.name
        }

        if(mod instanceof QSym) {
            this.set_current_package(mod.pkg)
            this.mod_name = mod.mod
        }

        const [source, path] = await this.slurp_mod(this.pkg, this.mod_name)
        assert(path, `No path returned for ${mod}`)
        this.loading_path = path
        await this.eval_string(source.toString(), path)
        // console.log(`Restoring *current-module* to ${prev_mod.inspect()}`)
        resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod)
        resolve(symbol("piglet", "lang", "*current-context*")).set_value(prev_mod.context)
        return mod
    }

    expand_qnames(o) {
        const postwalk = resolve(symbol('piglet:lang:postwalk'))
        const current_context = resolve(symbol('piglet:lang:*current-context*'))
        console.log("CTX", current_context)
        return postwalk((v)=>(v instanceof PrefixName ? Context.expand(deref(current_context), v) : v), o)
    }

    async register_package(location_href, pkg_spec) {
        console.log("Registering package", location_href)
        pkg_spec = assoc(pkg_spec, pkg$name, pkg_spec.get(pkg$name, location_href) )
        pkg_spec = assoc(pkg_spec, pkg$location, location_href)

        const pkg_name = pkg_spec.get(pkg$name)
        const pkg = module_registry.package_from_spec(pkg_spec)
        for (const [alias, dep_spec] of Array.from(pkg.deps)) {
            const loc = dep_spec.get(pkg$location)
            const dep_pkg = await this.load_package(loc)
            pkg.add_alias(alias.toString(), dep_pkg.name.toString())
        }
        return pkg
    }

    async eval(form) {
        // println(form)
        const ast = this.analyzer.analyze(form)
        // print_ast(0, ast)
        let estree = ast.emit(this.code_gen)
        // console.dir(estree, {depth: null})
        estree = this.code_gen.wrap_async_iife(ast, estree)
        let js = this.estree_to_js(estree)
        console.log(js)
        return await eval(js)
    }
}

// import {stdout} from 'node:process'
// const write = (s)=>stdout.write(s)

// function print_ast(depth, ast) {
//     const indent = (d)=>{for (let i =0 ; i < (d||depth);i++) { stdout.write(' ')}}
//     if (ast && ast?.inspect) {
//         write(ast.inspect())
//     } else if (Array.isArray(ast)) {
//         write("[\n")
//         for (let el of ast) {
//             indent(depth+2)
//             print_ast(depth+2, el)
//             write(",\n")
//         }
//         indent()
//         write("]")
//     } else if (ast && (typeof ast == 'object')) {
//         let type = ast?.constructor?.name
//         if(type) write(`${type} `)
//         write("{\n")
//         for (let [k, v] of ast instanceof Map ? ast.entries() : Object.entries(ast)) {
//             if (k === 'form' && Object.keys(ast).length != 1) {continue}
//             indent(depth+2)
//             write(k.toString())
//             write(': ')
//             if (v && v?.inspect) {
//                 write(v.inspect())
//                 write(",")
//                 write("\n")
//             } else if (v && (Array.isArray(v) || (typeof v == 'object'))) {
//                 print_ast(depth+2, v)
//                 write(",")
//                 write("\n")
//             } else {
//                 write('#js ')
//                 write(JSON.stringify(v)||`${ast}`)
//                 write(",\n")
//             }
//         }
//         indent()
//         write('}')
//     } else {
//         write('#js ')
//         write(JSON.stringify(ast)||`${ast}`)
//     }
// }
