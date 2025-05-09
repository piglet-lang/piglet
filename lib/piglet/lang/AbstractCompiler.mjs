// Copyright (c) Arne Brasseur 2023. All rights reserved.

import StringReader from "./StringReader.mjs"
import Analyzer from "./Analyzer.mjs"
import CodeGen from "./CodeGen.mjs"
import Context from "./Context.mjs"
import Module from "./Module.mjs"
import ModuleRegistry from "./ModuleRegistry.mjs"
import PrefixName from "./PrefixName.mjs"
import Sym from "./Sym.mjs"
import QSym from "./QSym.mjs"
import piglet_lang, {assoc, println, ensure_module, symbol, qname, resolve, deref, print_str, module_registry, expand_qnames, string_reader, data_readers, munge} from "../lang.mjs"
import {assert, assert_type} from "./util.mjs"
import {meta} from "./metadata.mjs"

const pkg$name = qname('https://vocab.piglet-lang.org/package/name')
const pkg$deps = qname('https://vocab.piglet-lang.org/package/deps')
const pkg$location = qname('https://vocab.piglet-lang.org/package/location')
const pkg$paths = qname('https://vocab.piglet-lang.org/package/location')

export default class AbstractCompiler {
  constructor(opts) {
    opts ||= {}
    this.opts = opts
    this.analyzer = new Analyzer()
    this.code_gen = new CodeGen(opts.codegen || {track_var_use: true})
    this.aot_codegen = new CodeGen(opts.codegen || {track_var_use: true, import_vars: true, export_vars: true})
    this.aot_compiling = false
    Object.defineProperty(this, 'verbosity', {get: ()=>{
      return ModuleRegistry.instance().find_module("https://piglet-lang.org/packages/piglet", "lang").resolve("*verbosity*").value
    }})
    this.hooks = opts.hooks || {}
    // const emit = this.code_gen.emit
    // this.code_gen.emit = (n,a)=>{console.log("\nEMITTING"); print_ast(0, n); return emit.call(this.code_gen, n, a)}
  }

  async slurp(path) {
    throw new Error("Not implemented")
  }

  async spit(path) {
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
    if (!ensure_module(mod.pkg, mod.mod)?.required) {
      const loaded = await this.load(mod)
      loaded.required = true
      return loaded
    }
    return false
  }

  async eval_string(source, filename, start_offset, line_offset) {
    return await this.eval_reader(string_reader(source, filename), filename, start_offset, line_offset)
  }

  async eval_reader(r, filename, start_offset, line_offset) {
    assert(filename)
    if (start_offset) r.start_offset = start_offset
    if (line_offset) r.line_offset = line_offset
    const self = this
    const read_and_eval = async function () {
      if (!r.eof()) {
        r.data_readers = data_readers.value.toJSON()
        let form
        try {
          form = r.read()
        } catch (err) {
          throw new Error(`Failed to read '${r.input}'`, {cause: err})
        }
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
    resolve(symbol("piglet", "lang", "*current-location*")).set_value(path)
    await this.eval_string(source.toString(), path)
    resolve(symbol("piglet", "lang", "*current-location*")).set_value(prev_mod.location)
    console.log("RESTORE MOD", prev_mod)
    resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod)
    resolve(symbol("piglet", "lang", "*current-context*")).set_value(prev_mod.context)
  }

  resolve_js_path(path) {
    return path
  }

  set_current_package(pkg) {
    resolve(symbol('piglet:lang:*current-package*')).set_value(module_registry.ensure_package(pkg))
  }

  async load(mod) {
    // console.log(`Loading ${mod.fqn || mod.name}: start`)
    // console.time(`Loading ${mod.fqn || mod.name}`)
    const prev_mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
    const current_package = resolve(symbol("piglet", "lang", "*current-package*")).deref()

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

    const [source, location] = await this.slurp_mod(resolve(symbol('piglet:lang:*current-package*')).value.name, this.mod_name)
    assert(location, `No location returned for ${mod}`)
    resolve(symbol("piglet", "lang", "*current-location*")).set_value(location)
    if (this.aot_compiling) {
      this.aot_output = []
      this.aot_stack.push(this.aot_output)
    }
    await this.eval_string(source.toString(), location)
    // console.log(`Restoring *current-module* to ${prev_mod.inspect()}`)
    resolve(symbol("piglet", "lang", "*current-location*")).set_value(prev_mod.location)
    mod = resolve(symbol("piglet", "lang", "*current-module*")).deref()
    if (this.aot_compiling) {
      const mod_outpath = `target/${mod.fqn.toString().replace(/[a-z-]+:\/+/, '')}.mjs`
      console.log(`Writing ${mod_outpath}`)
      this.mkdir_p(mod_outpath.replace(/[^/]*.mjs/, ''))
      const program = {type: 'Program', body: [
        ...this.aot_codegen.module_imports(mod),
        ...this.aot_output
      ]}
      let js = this.estree_to_js(program)
      if (mod.fqn.toString() === "https://piglet-lang.org/packages/piglet:lang") {
        js = `${await this.slurp("lib/piglet/lang.mjs")}\n${js}`
      }
      // console.dir(program, {depth: null})
      this.spit(mod_outpath, js)
      this.aot_stack.pop()
      this.aot_output = this.aot_stack.slice(-1)[0]
    }
    resolve(symbol("piglet", "lang", "*current-module*")).set_value(prev_mod)
    resolve(symbol("piglet", "lang", "*current-context*")).set_value(prev_mod.context)
    resolve(symbol("piglet", "lang", "*current-package*")).set_value(current_package)
    // console.timeEnd(`Loading ${mod.fqn || mod.name}`)
    return mod
  }

  async register_package(location_href, pkg_spec) {
    pkg_spec = assoc(pkg_spec, pkg$name, pkg_spec.get(pkg$name, location_href && location_href.replace("/package.pig", "")))
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
    if (this.verbosity >= 2) {
      println("--- form ------------")
      println(form)
    }
    const ast = this.analyzer.analyze(form)
    if (this.verbosity >= 3) {
      println("--- AST -------------")
      console.dir(ast, {depth: null})
    }
    let estree = ast.emit(this.code_gen)
    if (this.verbosity >= 4) {
      println("--- estree ----------")
      console.dir(estree, {depth: null})
    }
    if (this.hooks.estree) this.hooks.estree(estree)
    if (this.hooks.js) {
      this.hooks.js(
        this.estree_to_js(
          Array.isArray(estree) ?
            {type: 'Program', body: estree} :
          estree))
    }
    estree = this.code_gen.wrap_async_iife(ast, estree)
    if (this.verbosity >= 5) {
      println("--- WRAPPED estree ----------")
      console.dir(estree, { depth: null })
    }
    let js = this.estree_to_js(estree)
    if (this.verbosity >= 1) {
      println("--- js --------------")
      println(js)
    }
    const result = await eval(js)
    if (this.aot_compiling) {
      estree = ast.emit(this.aot_codegen)
      // console.dir(estree, {depth: null})
      if (Array.isArray(estree))
        this.aot_output.push(...estree)
      else
        this.aot_output.push(estree)
    }
    return result
  }

  async aot_compile(mod_sym) {
    this.aot_compiling = true
    this.aot_stack = []
    await this.load(mod_sym)
    this.aot_compiling = false
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
