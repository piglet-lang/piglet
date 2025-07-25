// Copyright (c) Arne Brasseur 2023-2025. All rights reserved.

/**
 * The analyzer turns Piglet code-as-data (lists, symbols, qsyms, vectors,
 * dicts, etc.) into a Piglet AST. While this AST still represents Piglet
 * concepts, it also already contains a bunch of things that are needed for the
 * mapping to JS, for instance the munging of symbols for local variables, and
 * the expansion of destructuring calls. Macroexpansion also happens in this
 * step.
 *
 * The result is an AST which can be fairly straightforwardly mapped to EStree
 * (the JS AST format we use), and from there to code, while being abstract
 * enough to support variations in JS output (e.g. AOT compilation vs REPL use).
 *
 * ASTNode classes all follow a similar pattern

 * - a constructor which takes the Piglet form the ASTNode is based on (mainly
 *   for location tracking), and any other ASTNode instances that are children
 *   of this node
 * - a static `from` method, which takes a Piglet form and a reference to the
 *   analyzer, and analyzes the given form, returning an ASTNode instance. So
 *   this method is responsible for recursively analyzing children
 * - a `emit` method which take a CodeGen instance, and returns ESTree (JS AST)
 *
 * The Analyzer's job is to look at a given Piglet form, figure out which type
 * of ASTNode it should turn into, then delegate to that ASTNode's static `from`
 * method for recursive analysis and ASTNode construction. Any state that needs
 * to be tracked is also kept on the analyzer, like which symbols currently map
 * to locals (vs vars), or what the current loop head is for recur calls.
 */

import {
  assoc,
  butlast,
  conj,
  cons,
  count,
  deref,
  dict,
  dict_p,
  dissoc,
  ensure_module,
  eq,
  filter,
  first,
  fourth,
  gensym,
  get,
  hash_code,
  inspect,
  intern,
  keyword,
  keyword_p,
  last,
  list,
  list_STAR,
  map,
  module_registry,
  nil_p,
  prewalk,
  print_str,
  println,
  qsym,
  reduce,
  remove,
  resolve,
  rest,
  second,
  select_keys,
  seq,
  seq_p,
  sequential_p,
  set_p,
  string_p,
  symbol,
  symbol_p,
  third,
  vary_meta,
  vector_p,
  with_meta,
} from "../lang.mjs"

import Associative from "./protocols/Associative.mjs"
import Hashable from "./protocols/Hashable.mjs"
import WithMeta from "./protocols/WithMeta.mjs"

import Keyword from "./Keyword.mjs"
import PrefixName from "./PrefixName.mjs"
import QName from "./QName.mjs"
import QSym from "./QSym.mjs"
import Sym from "./Sym.mjs"

import Dict from "./Dict.mjs"
import HashSet from "./HashSet.mjs"

import Context from "./Context.mjs"
import Module from "./Module.mjs"
import {PIGLET_PKG, partition_n, munge, valid_property_name_p, reserved_keyword_p} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"

const compiler_qsym        = qsym(`${PIGLET_PKG}:lang:*compiler*`)
const current_context_qsym = qsym(`${PIGLET_PKG}:lang:*current-context*`)
const current_module_qsym  = qsym(`${PIGLET_PKG}:lang:*current-module*`)
const first_qsym           = qsym(`${PIGLET_PKG}:lang:first`)
const as_iterator_qsym     = qsym(`${PIGLET_PKG}:lang:as-iterator`)
const get_qsym             = qsym(`${PIGLET_PKG}:lang:get`)
const intern_qsym          = qsym(`${PIGLET_PKG}:lang:intern`)
const rest_qsym            = qsym(`${PIGLET_PKG}:lang:rest`)

const def_sym   = symbol('def')
const fn_sym    = symbol('fn')
const quote_sym = symbol('quote')
const super_sym = symbol('super')
const this_sym  = symbol('this')
const while_sym = symbol('while')

const arities_kw  = keyword("arities")
const as_kw       = keyword("as")
const async_kw    = keyword("async")
const col_kw      = keyword("col")
const doc_kw      = keyword("doc")
const end_kw      = keyword("end")
const file_kw     = keyword("file")
const line_kw     = keyword("line")
const location_kw = keyword("location")
const macro_kw    = keyword("macro")
const more_kw     = keyword("more")
const or_kw       = keyword("or")
const start_kw    = keyword("start")
const static_kw   = keyword("static")

function current_module()  { return resolve(current_module_qsym).deref() }
function current_context() { return resolve(current_context_qsym).deref() }
function compiler()        { return resolve(compiler_qsym).deref() }

function is_sym_name(sym, name) {
  return symbol_p(sym) && sym._id_str === name
}

function is_kw_name(kw, name) {
  return keyword_p(kw) && kw._id_str === name
}

function vector(...args) {return args}  // placeholder for when we get real vectors

class ASTNode {
  constructor(form) {
    Object.defineProperty(this, 'form', {value: form, /*enumerable: false*/})
    set_meta(this, meta(form))
  }
  static from(form, analyzer) {
    return new this(form)
  }
  emit(cg) {
    if (this.children) {
      let result = []
      this.children.forEach((c)=>{
        const estree = cg.emit(this, c)
        if (Array.isArray(estree))
          result.push(...estree)
        else
          result.push(estree)
      })
      return result
    }
    return cg.emit(this, this.form)
  }
}

Hashable.extend2(
  ASTNode, {"-hash-code/1": (self)=>hash_code(self.form)},
)

/**
 * Function tail, i.e. argument vector + body
 *
 *     ([arg1 arg2] expr1 expr2)
 *
 * A function with arity overloading has multiple FnTails wrapped in an
 * ArityDispatch.
 */
class FnTail extends ASTNode {
  constructor(form, argv, body, arity, varargs) {
    super(form)
    this.argv = argv
    this.body = body
    this.arity = arity
    this.varargs = varargs // bool
    this.arities = varargs ? [[arity, more_kw]] : [arity]
  }

  static from(form, analyzer) {
    let [args_form, ...rest] = form
    const amp_idx = args_form.findIndex(is_sym_ampersand)
    const varargs = -1 !== amp_idx
    const arity = varargs ? amp_idx : count(args_form)

    const argv = []
    const bindings = []

    let args = [...args_form]
    while (args.length > 0) {
      let arg = args.pop()
      if (is_sym_ampersand(arg)) continue
      if (argv.some((a)=>eq(a, arg))) arg = gensym(arg)
      if (symbol_p(arg)) {
        argv.unshift(arg)
      } else {
        let bind = gensym("arg")
        argv.unshift(bind)
        bindings.unshift([arg, bind])
      }
    }

    return analyzer.with_locals(argv, ()=>{
      const argv_analyzed = varargs ?
            argv.slice(0, -1).map((s)=>analyzer.analyze(s)).concat([new RestExpr(argv[amp_idx], analyzer.analyze(argv[amp_idx]).identifier)]) :
            argv.map((s)=>analyzer.analyze(s))
      const flat_bindings = []

      for (const [lhs, rhs] of bindings) {
        const tmp = flatten_assignment_pair(lhs, rhs)
        if (tmp === undefined) {
          throw(new Error(`flatten bad result, ${first(form)}, ${bindings}, ${lhs}, ${rhs}`))
        }
        flat_bindings.push(...tmp)
      }
      const analyze_body = (analyzer)=>analyzer.with_loop_head(args_form.filter((s)=>!is_sym_ampersand(s)), ()=>LoopExpr.analyze_body(form, rest, analyzer))

      return new this(form,
                      argv_analyzed,
                      flat_bindings.length > 0 ?
                      [BindingScope.from(form, flat_bindings, analyze_body, MutableAssignment, analyzer)] :
                      analyze_body(analyzer),
                      arity,
                      varargs)

    })


    // ////// Args
    // // No destructuring or varags? Emit plain function arguments
    // if (args_form.every(symbol_p) && !varargs) {
    //   // JS doesn't like it if you reuse argument names, like having multiple _
    //   // args
    //   const seen = {}
    //   for (let idx = args_form.length-1 ; idx >= 0 ; idx--) {
    //     if (args_form[idx].name in seen) {
    //       args_form[idx]=gensym("_")
    //     }
    //     seen[args_form[idx].name]=true
    //   }
    //   return analyzer.with_locals(args_form, ()=>{
    //     return new this(form,
    //                     args_form.map(a=>analyzer.analyze(a)),
    //                     analyzer.analyze_forms(rest),
    //                     arity,
    //                     varargs)
    //   })
    // }
    // // Any sort of destructuring? Emit a function without arguments,
    // // and destructure js:arguments sequentially instead
    // const has_ampersand = args_form.find(is_sym_ampersand)
    // const argv_syms = new Array(has_ampersand ? args_form.length-1 : args_form.length).fill(null).map((_)=>gensym("arg"))
    // return analyzer.with_locals(argv_syms,()=>{
    //   const argv = argv_syms.map((s)=>analyzer.analyze(s))
    //   if (has_ampersand) {
    //     argv[argv.length-1] = new RestExpr(argv[argv.length-1], argv[argv.length-1].identifier)
    //   }
    //     const bindings = flatten_assignment_pair(args_form, argv)
    //   return new this(form,
    //                   argv,
    //                   [BindingScope.from(form, bindings, (a)=>a.analyze_forms(rest), ConstAssignment, analyzer)],
    //                   arity,
    //                   varargs)
    // })

    // TODO support loop/recur

    // ////// Body
    // // Support recur directly inside a fn/defn
    // if (recurs_p(last(rest))) {
    //   analyzer.with_loop_bindings(args_form, ()=>body.push(LoopExpr.analyze_body(form, rest, analyzer)))
    // } else {
    //   body.push(...analyzer.analyze_forms(rest))
    // }
    // const arity = varargs ? amp_idx : count(args_form)
    // return new this(form, argv, body, arity, varargs)
  }
}

class ArityDispatch extends ASTNode {
  constructor(form, body, arities) {
    super(form)
    this.argv = []
    this.body = body
    this.arities = arities
  }

  static from(form, analyzer) {
    let body = []
    const arg_len_expr = analyzer.analyze(symbol("js:arguments.length"))
    const sort_val = (tail) => tail.varargs ? 1000 + tail.arity : tail.arity
    let tails = Array.from(form, (tail_form)=>FnTail.from(tail_form, analyzer)).sort((a, b)=>sort_val(b)-sort_val(a))
    analyzer.with_locals([symbol("args")], ()=>{
      body.push(new ConstAssignment(null, analyzer.analyze(symbol("args")), JsIdentifierExpr.from("arguments")))
      body.push(
        reduce(
          (acc, tail) => new IfStmt(
            tail.form,
            new InfixOpExpr(null, tail.varargs ? "<=" : "===", [tail.arity, arg_len_expr]),
            new DoExpr(
              tail.form,
              [new ConstAssignment(tail, tail.argv, analyzer.analyze(symbol("args"))),
               ...butlast(tail.body),
               last(tail.body) //&& new ReturnStmt(last(tail.body).form, last(tail.body))
              ]),
            acc),
          analyzer.analyze(list(symbol("throw"), list(symbol("js:Error."), "Illegal arity"))),
          tails))
    })
    return new this(form, body, tails.map((t)=>t.arities[0]))
  }
}

function is_sym_ampersand(o) {
  return is_sym_name(o, "&")
}

class FnExpr extends ASTNode {
  constructor(form, name, fntail, metadata) {
    super(form)
    this.name = name
    this.fntail = fntail // FnTail or ArityDispatch
    this.meta = metadata
  }

  static from(form, analyzer) {
    let name, fntail, metadata = dict()
    let [_fn, o, ...tail] = form

    if (o instanceof Sym || o instanceof QSym) {
      name = o
      metadata = meta(o)
      o = tail.shift()
    }

    return analyzer.with_locals_no_gensym(name ? [name] : [], ()=>{
      if (vector_p(o)) {
        // (fn [_] ,,,)
        if (meta(o)) {
          for (const [k, v] of meta(o)) {
            metadata = metadata.assoc(k, v)
          }
        }
        fntail = FnTail.from(cons(o, tail), analyzer)
      } else if (seq_p(o)) {
        // (fn ([] ,,,) ([a] ,,,))
        fntail = ArityDispatch.from(cons(o, tail), analyzer)
      } else {
        throw(`Malformed 'fn' form: ${form}`)
      }
      metadata = (metadata || dict()).assoc(arities_kw, fntail.arities)
      return new this(form, name, fntail, metadata)
    })
  }

  emit(cg) {
    return cg.function_expr(this, {name: this.name ? cg.identifier(this.name, munge(this.name.name)) : null,
                                   argv: this.fntail.argv.map(e=>e.emit(cg)),
                                   body: this.fntail.body.map(e=>e.emit(cg)),
                                   async_p: get(this.meta, async_kw),
                                   meta: this.meta})
  }
}

class ConstantExpr extends ASTNode {
  constructor(form) {
    super(form)
    this.value = form
  }
}

/**
 * Invoke a function with arguments
 */
class InvokeExpr extends ASTNode {
  constructor(form, fn, args) {
    super(form)
    this.fn = fn
    this.args = args
  }

  static from(form, analyzer) {
    const [fn, ...args] = form
    return new this(form, analyzer.analyze_without_meta(fn), args.map(a=>analyzer.analyze(a)))
  }

  emit(cg) {
    return cg.function_call(this, cg.emit(this, this.fn), this.args.map(a=>cg.emit(this,a)))
  }
}

/**
 * Invoke a piglet var. Not strictly necessary since we can do a VarLookupExpr +
 * InvokeExpr, but making this a separate case allows us to specialize the code
 * gen for direct var invocations.
 */
class InvokeVarExpr extends ASTNode {
  constructor(form, the_var, args) {
    super(form)
    this.the_var = the_var
    this.args = args
  }

  static from(form, analyzer) {
    const [var_sym, ...args] = form
    const the_var = resolve(var_sym)
    const arities = meta(the_var.value)?.get(arities_kw)
    if (arities) {
      const arity = args.length
      if (undefined === arities.find((a)=>(Array.isArray(a) && arity >= a[0]) || arity === a)) {
        console.log(`WARN: Wrong arity for ${var_sym}, expected ${arities.join(", ")}, got ${arity}`)
      }
    }
    return new this(form, the_var, args.map(a=>analyzer.analyze(a)))
  }
  emit(cg) {
    return cg.invoke_var(this, this.the_var.pkg, this.the_var.module, this.the_var.name, this.args.map(a=>cg.emit(this,a)))
  }
}

/**
 * Lookup of JS properties by using a symbol contains dots, like foo.bar.baz,
 * when used as a value rather than a function, so not in head position in a
 * list form.
 */
class HostVarExpr extends ASTNode {
  constructor(sym, parts) {
    super(sym)
    this.parts = parts
  }

  static from(sym) {
    const parts = sym.name.split('.').reduce((acc, s)=>{
      const part = symbol(null, null, s)
      const [prev] = acc.slice(-1)
      part.start = prev ? prev.end+2 : sym.start
      part.end   = part.start + part.name.length
      part.line  = sym.line
      part.col   = prev ? prev.col+2 : sym.col
      return acc.concat([part])
    }, [])
    return new this(sym, parts)
  }

  emit(cg) {
    return cg.member_lookup(this, cg.identifier(this.parts[0], this.parts[0].name), this.parts.slice(1))
  }
}

/**
 * A bare JS identifier, e.g. for a local or global var.
 */
class JsIdentifierExpr extends ASTNode {
  constructor(form, identifier) {
    super(form)
    this.identifier = identifier
  }
  static from(form) {
    if (typeof form === 'string') {
      return new this(form, form)
    }
    if (symbol_p(form)) {
      return new this(form, form.name)
    }
    throw new Error(`JsIdentifierExpr expects string or symbol, got ${form}`)
  }
  emit(cg) {
    return cg.identifier(this, this.identifier)
  }
}

/**
 * [... foo]
 */
class RestExpr extends ASTNode {
  constructor(form, identifier) {
    super(form)
    this.identifier = identifier
  }
  emit(cg) {
    return cg.rest_element(this, this.identifier)
  }
}

/**
 * Use of a piglet var as a value in an expression
 */
class VarLookupExpr extends ASTNode {
  constructor(form) {
    super(form)
    this.expr = form
  }
  emit(cg) {
    return cg.var_value(this, this.form)
  }
}

/**
 * Interop method call, i.e. starts with a `.`, like `(.foo bar)`
 */
class MethodCallExpr extends ASTNode {
  constructor(form, method, object, args) {
    super(form)
    this.method = method
    this.object = object
    this.args = args
  }

  static from(form, analyzer) {
    const [f1, f2, ...rest] = form
    const method = symbol(null, null, f1.name.slice(1)) // chop off the "."
    Object.assign(method, {start: f1.start, end: f1.end, line: f1.line, col: f1.col})
    const object  = analyzer.analyze(f2)
    const args = rest.map(f=>analyzer.analyze(f))
    return new this(form, method, object, args)
  }

  emit(cg) {
    return cg.method_call(this, this.method, this.object.emit(cg), this.args.map(a=>cg.emit(this,a)))
  }
}

class MemberLookupExpr extends ASTNode {
  constructor(form, object, parts) {
    super(form)
    this.object = object
    this.parts = parts
  }

  static from(form, analyzer) {
    const [f1, f2] = form
    const parts = f1.name.slice(2).split('.').reduce((acc, s)=>{
      const part = symbol(null, null, s)
      const [prev] = acc.slice(-1)
      part.start = prev ? prev.end+2 : f1.start
      part.end   = part.start + part.name.length
      part.line  = f1.line
      part.col   = prev ? prev.col+2 : f1.col
      return acc.concat([part])
    }, [])
    const object  = analyzer.analyze(f2)
    return new this(form, object, parts)
  }

  emit(cg) {
    return this.parts.reduce((acc,sym)=>{
      let computed = !valid_property_name_p(sym.name)
      return cg.member_expr(sym,
                            acc,
                            computed ? cg.literal(sym, sym.name) : cg.identifier(sym, sym.name),
                            computed)
    }, this.object.emit(cg))
  }
}

//*******************************

/**
 * (def xxx 123)
 * Emits a call to piglet:lang:intern. A single instance is created for each
 * var, in case of destructuring forms
 */
class VarAssignment extends ASTNode {
  constructor(form, var_sym, value, meta) {
    super(form)
    this.var_sym = var_sym
    this.value = value
    this.meta = meta
  }

  static meta_keys = [start_kw, end_kw, col_kw, line_kw, file_kw, location_kw]

  static from(form, var_sym, rhs_form, analyzer) {
    const meta_form = reduce(conj, meta(var_sym) || dict(), select_keys(meta(form), this.meta_keys))
    const meta_val = analyzer.analyze_without_meta(meta_form)
    const the_var = current_module().ensure_var(var_sym.name, null, meta) // (do (def x 1) (inc x))
    return new this(form, the_var.fqn, rhs_form, meta_val)
  }

  emit(cg) {
    return cg.define_var(this, this.var_sym, cg.emit(this, this.value), cg.emit(this, this.meta))
  }
}

/**
 * A single local binding (introduced by let, loop, etc), and the code that
 * executes with that binding active. When constructing a list of binding pairs
 * is given, plus the body that executes with those bindings active, and the
 * result is a structure of nested BindingScopes, one for each pair. Pairs are
 * flattened beforehand, so we are no longer concerned with destructuring at
 * this point.
 */
class BindingScope extends ASTNode {
  constructor(form, binding, body) {
    super(form)
    this.children = [binding, ...body]
  }

  static from(form, [[lhs, rhs], ...bindings], body_cb, assignment_type, analyzer) {
    const rhs_analyzed = analyzer.analyze(rhs)
    const carrier = get(meta(lhs), "carrier")
    const first_carrier = get(meta(lhs), "first_carrier")

    return analyzer.with_locals(carrier && !first_carrier ? [] : [lhs], ()=>{
      return new this(
        form,
        (carrier ? first_carrier ? MutableAssignment : Reassignment : assignment_type).from(
          form,
          lhs,
          rhs_analyzed,
          analyzer
        ),
        seq(bindings) ?
          [this.from(form, bindings, body_cb, assignment_type, analyzer)] :
          body_cb(analyzer)
      )
    })
  }
}

/**
 * Base for any "plain" JS assigment (let foo = ... / const foo = ... / foo = ...)
 */
class AssignmentBase extends ASTNode {
  constructor(form, lhs_expr, rhs_expr) {
    super(form)
    this.lhs_expr = lhs_expr
    this.rhs_expr = rhs_expr
  }

  static from() {
    throw new Error("...")
  }

  emit(cg) {
    return cg[this.constructor.code_gen_method](this, cg.emit(this, this.lhs_expr), cg.emit(this, this.rhs_expr))
  }
}

/**
 * `const foo = ...`
 */
class ConstAssignment extends AssignmentBase {
  static code_gen_method = 'const_var_decl'

  static from(form, lhs, rhs, analyzer) {
    return new this(form, analyzer.analyze(lhs), rhs)
  }
}

/**
 * `let foo = ...`
 * Not calling this LetAssignment so we don't confuse it with `(let ...)`
 */
class MutableAssignment extends AssignmentBase {
  static code_gen_method = 'let_var_decl'

  static from(form, lhs, rhs, analyzer) {
    return new this(form, analyzer.analyze(lhs), rhs)
  }
}

/**
 * `foo = ...`
 */
class Reassignment extends AssignmentBase {
  static code_gen_method = 'assignment'

  static from(form, lhs, rhs, analyzer) {
    return new this(form, analyzer.analyze(lhs), rhs)
  }
}

//////////////////////////////////////////////////////////////////////
// Binding contexts

class DefExpr extends ASTNode {
  constructor(form, bind_expr) {
    super(form)
    this.bind_expr = bind_expr
  }
  static from(form, analyzer) {
    let [_def, binding, ...body] = form
    const arity = count(form)
    if (arity !== 3 && arity !== 4) {
      throw new Error(`Wrong number of arguments to def, ${print_str(form)}`)
    }
    let doc = null
    if (arity === 4) {
      if (!string_p(first(body))) {
        throw new Error(`Expected a docstring as the second argument to def, got ${print_str(first(body))}`)
      }
      doc = first(body)
      body = rest(body)
    }


    const bindings = map(
      ([lhs,rhs])=>[vary_meta(lhs, assoc, "no_gensym", true), rhs],
      flatten_assignment_pair(doc ? vary_meta(binding, assoc, doc_kw, doc) : binding,
                              first(body)))
    // println(current_module(),bindings)
    return new this(form, BindingScope.from(form, bindings, ()=>[], VarAssignment, analyzer))
  }

  emit(cg) {
    return cg.emit(this, this.bind_expr)
  }
}

function find_as(lhs) { // find [... :as ...]
  let new_lhs = []
  let as = null
  while (lhs) {
    if (is_kw_name(first(lhs), "as")) {
      lhs = rest(lhs)
      if (!lhs) {
        throw new Error(":as must be followed by a symbol, found end of destructuring form")
      }
      as = first(lhs)
    } else {
      new_lhs.push(first(lhs))
    }
    lhs = rest(lhs)
  }
  return [new_lhs, as]
}

/**
 * Take a single assignment pair as given in a let binding, and expand any
 * destructuring forms such that all lhs forms are plain symbols
 */
function flatten_assignment_pair(lhs, rhs, nest) {
  nest||=0
  // Already a symbol, we're done
  if (symbol_p(lhs)) {
    return [[lhs, rhs]]
  }

  // Vector
  if (vector_p(lhs)) {
    // First check if we have an `:as`, that can act as a the carrier
    let res = []
    let [new_lhs, as_sym] = find_as(lhs)
    if (as_sym) {
      // as-sym = <rhs-form>
      res.push([as_sym, rhs])
      rhs = as_sym
    }
    let carrier = with_meta(symbol(`c${nest}`), dict("carrier", true)) // mark the carrier so we don't introduce a var
    // carrier = <rhs-form> / as-sym
    // We can't use the as-sym as carrier because we mutate the carrier
    res.push([vary_meta(carrier, assoc, "first_carrier", true), rhs])
    for (let idx = 0 ; idx < lhs.length ; idx++) {
      const o = lhs[idx]
      if (is_sym_name(o, "&")) {
        // Rest args, one more form after `&` which gets destructured against the carrier
        // rest = carrier
        res.push(...flatten_assignment_pair(lhs[idx+1], carrier, nest+1))
        idx++ // We skip an extra form
      } else if (is_kw_name(o, "as")) {
        idx+=2
      } else if (idx+1 == lhs.length) {
        // End case, assign next arg, no more need to update the carrier
        // y = first(carrier)
        res.push(...flatten_assignment_pair(last(lhs), list(first_qsym, carrier), nest+1))
      } else {
        // Base case, assign next arg, and drop the head of the carrier
        // x = first(carrier)
        // carrier = rest(carrier)
        const foo = flatten_assignment_pair(o, list(first_qsym, carrier), nest+1)
        res.push(...foo,
                 [carrier, list(rest_qsym, carrier)])
      }
    }
    return res
  }

  if (dict_p(lhs)) {
    let res = []
    const as_sym = lhs.get(as_kw, vary_meta(symbol("dict-as"), assoc, "carrier", true, "first_carrier", true))
    const or_dict = lhs.get(or_kw, dict())
    lhs = lhs.dissoc(as_kw).dissoc(or_kw)
    res.push([as_sym, rhs])
    for (const [k, v] of lhs) {
      if (k instanceof Keyword) {
        if (!vector_p(v)) throw new Error(`Dict destructuring ${k}, expected vector value, got ${inspect(v)}.`)
        for (const sym of v) {
          res.push([sym,
                    k.name === "strs" ? list(get_qsym, as_sym, sym.name, or_dict.get(sym))
                    : k.name === "keys" ? list(get_qsym, as_sym, keyword(sym.name), or_dict.get(sym))
                    : k.name === "syms" ? list(get_qsym, as_sym, list(quote_sym, symbol(sym.name)), or_dict.get(sym))
                    : k.name === "props" ? list(symbol(`.-${sym.name}`), as_sym)
                    : (()=>{throw new Error(`Dict destructuring, expected :keys, :strs, or :syms. Got ${k}.`)})()])
        }
      } else if (k instanceof PrefixName) {
      } else if (k instanceof QName) {
      } else if (k instanceof QSym) {
      } else {
        res.push(...flatten_assignment_pair(k, list(get_qsym, as_sym, v), nest+1))
      }
    }
    return res
  }

  throw new Error(`Bad binding form ${lhs}, ${lhs.constructor.name}`)
}

class LetExpr extends ASTNode {
  constructor(form, children) {
    super(form)
    this.children = children
  }


  static from(form, analyzer, is_loop_tail) {
    let [_, bindings, ...body] = form
    bindings = reduce((acc,[lhs,rhs])=>acc.concat(flatten_assignment_pair(lhs, rhs)), [], partition_n(2, bindings))
    return new this(form, [BindingScope.from(form, bindings, (a)=>is_loop_tail ? LoopExpr.analyze_body(form, body, a) : a.analyze_forms(body), ConstAssignment, analyzer)])
  }
}

class MacroVarExpr extends ASTNode {
  constructor(form, var_sym, argv, body) {
    super(form)
    this.var_sym = var_sym
    this.argv = argv
    this.body = body
  }
  static from(form, analyzer) {
    let [_defmacro, var_sym, ...more] = form
    let expanded_form = null
    if (string_p(first(more))) {
      expanded_form = list(def_sym, vary_meta(var_sym, assoc, macro_kw, true), first(more), list_STAR(fn_sym, second(more), rest(rest(more))))
    } else {
      expanded_form = list(def_sym, vary_meta(var_sym, assoc, macro_kw, true), list_STAR(fn_sym, first(more), rest(more)))
    }
    return analyzer.analyze(expanded_form)
  }
}

//////////////////////////////////////////////////////////////////////

class QuoteExpr extends ASTNode {
  emit(cg) {
    const [_, form] = this.form
    return cg.emit(this, form)
  }
}

class IfExpr extends ASTNode {
  constructor(form, test, if_branch, else_branch) {
    super(form)
    this.test = test
    this.if_branch = if_branch
    this.else_branch = else_branch
  }
  static from(form, analyzer) {
    const [_, test, if_branch, else_branch] = form

    return new this(
      form,
      analyzer.analyze(list(symbol("piglet:lang:truthy?"), test)), // TODO: check for boolean tag
      analyzer.analyze(if_branch),
      nil_p(else_branch) ? null : analyzer.analyze(else_branch)
    )
  }
  emit(cg) {
    return cg.conditional(this, this.test.emit(cg), this.if_branch.emit(cg), nil_p(this.else_branch) ? null : this.else_branch.emit(cg))
  }
}

class IfStmt extends IfExpr {
  static from_fn_tail(form, analyzer) {
    const [_if, test, consequent, alt] = form
    return new this(form,
                    analyzer.analyze(list(symbol("piglet:lang:truthy?"), test)),
                    LoopExpr.analyze_tail_form(consequent, analyzer),
                    LoopExpr.analyze_tail_form(alt, analyzer))
  }
  emit(cg) {
    return cg.if_stmt(this, this.test.emit(cg), this.if_branch.emit(cg), nil_p(this.else_branch) ? null : this.else_branch.emit(cg))
  }
}

class AwaitExpr extends ASTNode {
  constructor(form, arg) {
    super(form)
    this.arg = arg
  }
  static from(form, analyzer) {
    const [_, arg] = form
    return new this(form, analyzer.analyze(arg))
  }
  emit(cg) {
    return cg.await_expr(this, cg.emit(this, this.arg))
  }
}

class SpecialSymbolExpr {
  static SPECIALS = {
    "true": true,
    "false": false,
    "nil": null,
    "undefined": void(0)
  }

  constructor(form, value) {
    this.form = form
    this.value = value
  }
  static from(form) {
    return new this(form, this.SPECIALS[form.name])
  }
  static is_special(s) {
    return s in this.SPECIALS
  }
  emit(cg) {
    return cg.literal(this, this.value)
  }
}

const INFIX_OPERATORS = {
  "-": "-",
  "+": "+",
  "*": "*",
  "/": "/",
  "<": "<",
  ">": ">",
  ">=": ">=",
  "<=": "<=",
  "mod": "%",
  "power": "**",
  "==": "==",
  "===": "===",
  "!==": "!==",
  "instance?": "instanceof",
  "and": "&&",
  "or": "||",
  "bit-shift-left": "<<",
  "bit-shift-right": ">>",
  "bit-and": "&",
  "bit-or": "|",
  "bit-xor": "^",
  "in": "in"
}

const FLIPPED_INFIX_OPERATORS = ["instanceof", "in"]
const PAIRWISE_INFIX_OPERATORS = ["<", ">", "<=", ">=", "==", "==="]

const UNARY_OPERATORS = {
  "typeof": "typeof",
  "-": "-"
  // TODO: we can only emit this when we know we have a true boolean, if not we must go through truthy?
  // "not": "!"
}

class InfixOpExpr extends ASTNode {
  constructor(form, op, args) {
    super(form)
    this.op = op
    this.args = args
  }
  static from(form, analyzer) {
    const [op, ...rest] = form
    return new this(form, INFIX_OPERATORS[op.name], rest.map(e=>analyzer.analyze(e)))
  }
  emit(cg) {
    if (FLIPPED_INFIX_OPERATORS.includes(this.op)) {
      return cg.infix_op(this, this.op, this.args.reverse().map(a=>cg.emit(this,a)))
    }
    if (PAIRWISE_INFIX_OPERATORS.includes(this.op)) {
      return cg.pairwise_infix_op(this, this.op, "&&", this.args.map(a=>cg.emit(this,a)))
    }
    return cg.infix_op(this, this.op, this.args.map(a=>cg.emit(this,a)))
  }
}

class UnaryOpExpr extends ASTNode {
  constructor(form, op, argument) {
    super(form)
    this.op = op
    this.argument = argument
  }
  static from(form, analyzer) {
    const [op, arg] = form
    return new this(form, UNARY_OPERATORS[op.name], analyzer.analyze(arg))
  }
  emit(cg) {
    return cg.unary_expression(this, this.op, cg.emit(this.argument, this.argument), true)
  }
}

class ArrayExpr extends ASTNode {
  constructor(form, args) {
    super(form)
    this.args = args
  }

  static from(form, analyzer) {
    const [_, ...rest] = form
    return new this(form, rest.map(e=>analyzer.analyze(e)))
  }

  emit(cg) {
    return cg.array_literal(this, this.args.map(a=>cg.emit(this,a)))
  }
}

class NewExpr extends ASTNode {
  constructor(form, ctor, args) {
    super(form)
    this.ctor = ctor
    this.args = args
  }
  static from(form, analyzer) {
    const [_, ctor, ...rest] = form
    return new this(form, analyzer.analyze(ctor), rest.map(e=>analyzer.analyze(e)))
  }
  emit(cg) {
    return cg.new_expr(this, cg.emit(this, this.ctor), this.args.map(a=>cg.emit(this,a)))
  }
}

class VectorExpr extends ASTNode {
  constructor(form, coll) {
    super(form)
    this.coll = coll
  }
  static from(form, analyzer) {
    return new this(form, analyzer.analyze_forms(form))
  }
  emit(cg) {
    return cg.emit(this, this.coll)
  }
}

class DictExpr extends ASTNode {
  constructor(form, dict) {
    super(form)
    this.dict = dict
  }
  static from(form, analyzer) {
    return new this(
      form,
      with_meta(
        reduce((d, [k, v])=>Associative._assoc(d, analyzer.analyze(k), analyzer.analyze(v)),
               Dict.EMPTY,
               form),
        meta(form)
      )
    )
  }
  emit(cg) {
    return cg.emit(this, this.dict)
  }
}

class HashSetExpr extends ASTNode {
  constructor(form, set) {
    super(form)
    this.set = set
  }
  static from(form, analyzer) {
    return new this(
      form,
      HashSet.of(meta(form), ...map(analyzer.analyze.bind(analyzer), form))
    )
  }
  emit(cg) {
    return cg.emit(this, this.set)
  }
}

class JsObjLiteral extends ASTNode {
  constructor(form, obj) {
    super(form)
    this.obj = obj
  }
  static from(form, analyzer) {
    return new this(
      form,
      Array.from(Object.entries(form)).reduce((acc, [k, v])=>(acc[k]=analyzer.analyze(v), acc), Object.create(null))
    )
  }
  emit(cg) {
    return cg.object_literal(this, Object.entries(this.obj).map(([k, v]) => [cg.emit(k, k), cg.emit(v, v)], Object.create(null)))
  }
}

class SetExpr extends ASTNode {
  constructor(form, left, right) {
    super(form)
    this.left = left
    this.right = right
  }
  static from(form, analyzer) {
    const [_, left, right] = form
    return new this(form, analyzer.analyze(left), analyzer.analyze(right))
  }
  emit(cg) {
    return cg.assignment(this, cg.emit(this, this.left), cg.emit(this, this.right))
  }
}

class DoExpr extends ASTNode {
  constructor(form, body) {
    super(form)
    this.body = body
  }
  static from(form, analyzer, is_loop_tail) {
    const [_, ...rest] = form
    return new this(form, is_loop_tail ? LoopExpr.analyze_body(form, rest, analyzer) : analyzer.analyze_forms(rest))
  }
  emit(cg) {
    if (this.body.length === 1)
      return cg.emit(this.body[0], this.body[0])
    return this.body.map((e) => cg.emit(this, e))
  }
}

class ModuleExpr extends ASTNode {
  constructor(form, children) {
    super(form)
    this.children = children
  }
  static from(form, analyzer) {
    // console.log(`Analyzing module form, current-module=${current_module().inspect()}, analyzing=${Array.from(form)[1].inspect()}`)
    const current_package = deref(resolve(symbol('piglet:lang:*current-package*')))
    const mod_opts = Module.parse_opts(current_package.name, form)
    // const interned_mod = ensure_module(current_package, mod_opts.get('name'))
    const interned_mod = module_registry.parse_module_form(current_package, form)
    interned_mod.location = deref(resolve(symbol('piglet:lang:*current-location*')))
    return analyzer.with_locals([interned_mod.self_ref], ()=>{
      const analyze = analyzer.analyze.bind(analyzer)
      const self = interned_mod.self_ref
      const children = [
        (new ConstAssignment(
          form,
          analyzer.analyze(self),
          analyze(
            list(symbol('.register_module'),
                 symbol('piglet:lang:module-registry'),
                 list(quote_sym,
                      {pkg: interned_mod.pkg,
                       name: interned_mod.name,
                       imports: interned_mod.imports.map((({alias, from})=>({alias:alias, from: from.fqn}))),
                       context: interned_mod?.context,
                       location: interned_mod.location,
                       self_ref: self}))
          ),
          null)
        ),

        analyze(list(intern_qsym,
                     list(quote_sym, current_module_qsym),
                     self)),
        analyze(list(intern_qsym,
                     list(quote_sym, current_context_qsym),
                     list(symbol('.-context'), interned_mod.self_ref))),
        ...(interned_mod.imports.map(({from, alias, js_module, module_path})=>{
          if (js_module) {
            return analyze(
              list(symbol('.set_alias'),
                   self,
                   alias.name,
                   list(symbol('await'),
                        list(symbol('piglet:lang:js-import'), module_path)))
            )
          }
          return analyze(list(symbol('await'), list(symbol('piglet:lang:import'), list(symbol("quote"), from.fqn))))
        })),
        self
      ]
      return new this(form, children)
     })
  }
}

class ThrowExpr extends ASTNode {
  constructor(form, argument) {
    super(form)
    this.argument = argument
  }
  static from(form, analyzer) {
    return new this(form, analyzer.analyze(second(form)))
  }
  emit(cg) {
    return cg.throw_stmt(this, cg.emit(this.argument, this.argument))
  }
}

class VarExpr extends ASTNode {
  emit(cg) {
    return cg.var_ref(this, second(this.form))
  }
}

class WhileExpr extends ASTNode {
  constructor(form, test, body) {
    super(form)
    this.test = test
    this.body = body
  }
  static from(form, analyzer) {
    const [test, ...body] = analyzer.analyze_forms(rest(form))
    return new this(form, test, body)
  }
  emit(cg) {
    return cg.while_stmt(this, cg.emit(this.test, this.test), this.body.map((o)=>cg.emit(o,o)))
  }
}

class MetaExpr extends ASTNode {
  constructor(form, analyzed_form, meta) {
    super(form)
    this.analyzed_form = analyzed_form
    this.meta = meta
  }

  static from(form, analyzed_form, analyzer) {
    let meta_form = meta(form)
    // METAHACKS: taking location metadata out for now as it makes generated
    // code so much harder to read, and having it on everything kills
    // performance. Needs to be revisited. See also other METAHACKS notes.
    meta_form = dissoc(meta_form, start_kw, end_kw, col_kw, file_kw, line_kw)
    if (meta_form == null || 0 === count(meta_form)) {
      return analyzed_form
    }
    analyzer.emit_meta = false
    const meta_expr = analyzer.analyze(meta_form)
    analyzer.emit_meta = true
    return new this(form, analyzed_form, meta_expr)
  }

  emit(cg) {
    return cg.wrap_set_meta(
      cg.emit(this, this.analyzed_form),
      this.meta
    )
  }
}

class TryExpr extends ASTNode {
  constructor(form, body,
              catch_form, catch_arg, catch_body,
              finalizer_form, finalizer_body) {
    super(form)
    this.body = body
    this.catch_form = catch_form
    this.finalizer_form = finalizer_form
    this.catch_arg = catch_arg
    this.catch_body = catch_body
    this.finalizer_body = finalizer_body
  }
  static from(form, analyzer) {
    let catch_form, catch_arg, catch_body, finalizer_form, finalizer_body, body, f, catch_body_forms, tail
    body = rest(form)
    f = last(body)
    if (seq_p(f) && is_sym_name(first(f), "finally")) {
      body = butlast(body)
      finalizer_form = f
      finalizer_body = analyzer.analyze_forms(rest(finalizer_form))
      f = last(body)
    }
    if (seq_p(f) && is_sym_name(first(f), "catch")) {
      body = butlast(body)
      catch_form = f
      f = rest(f)
      catch_arg = first(f)
      catch_body_forms = rest(f)
      analyzer.with_locals([catch_arg], ()=>{
        tail = new ReturnStmt(form, analyzer.analyze(last(catch_body_forms)))
        catch_arg = analyzer.analyze_without_meta(catch_arg)
        catch_body = analyzer.analyze_forms(butlast(catch_body_forms)).concat([tail])
      })
    }
    body = analyzer.analyze_forms(body)
    tail = new ReturnStmt(form, analyzer.analyze(last(body)))
    body = analyzer.analyze_forms(butlast(body)).concat([tail])
    return new this(form, body,
                    catch_form, catch_arg, catch_body,
                    finalizer_form, finalizer_body)
  }
  emit(cg) {
    return cg.wrap_iife(
      this.form,
      cg.try_stmt(this.form, this.body,
                  this.catch_form, this.catch_arg, this.catch_body,
                  this.finalizer_form, this.finalizer_body))
  }
}

class LoopExpr extends ASTNode {
  constructor(form, binding_scope) {
    super(form)
    this.binding_scope = binding_scope
  }

  /**
   * Handle `recur` in tail position
   */
  static analyze_tail_form(form, analyzer) {
    form = analyzer.macroexpand(form)
    if (seq_p(form)) {
      const initial = first(form)
      if (initial instanceof Sym && initial.mod == null) {
        switch (initial.name) {
        case "if":
          return IfStmt.from_fn_tail(form, analyzer)
        case "recur":
          return RecurExpr.from(form, analyzer)
        case "do":
          return DoExpr.from(form, analyzer, true)
        case "let":
          return LetExpr.from(form, analyzer, true)
        default:
        }
      }
    }
    return new ReturnStmt(form, analyzer.analyze(form))
  }

  static analyze_body(form, body, analyzer) {
    if (body.length === 0) {
      return []
    } else if (body.length === 1) {
      const tail = this.analyze_tail_form(last(body), analyzer)
      return [tail]
    }
    const tail = this.analyze_tail_form(last(body), analyzer)
    const body_analyzed = analyzer.analyze_forms(butlast(body)).concat([tail])
    return body_analyzed
  }

  static from(form, analyzer) {
    let [_loop, bindings, ...body] = form
    if (count(bindings) % 2 !== 0) {
      throw new Error("Invalid loop: binding vector requires even number of forms")
    }

    const binding_pairs = partition_n(2, bindings)
    const binding_forms = map(first, binding_pairs)
    const flat_pairs = reduce((acc,[lhs,rhs])=>acc.concat(flatten_assignment_pair(lhs, rhs)), [], binding_pairs)
    const analyze_body = (analyzer)=>{
      return analyzer.with_loop_head(binding_forms, ()=>this.analyze_body(form, body, analyzer))
    }
    if (count(flat_pairs) > 0) {
      const bindings_scope = BindingScope.from(form, flat_pairs, analyze_body, MutableAssignment, analyzer)
      return new this(form, bindings_scope)
    }
    return new this(form, new DoExpr(form, analyze_body(analyzer)))
  }

  emit(cg) {
    return cg.wrap_iife(this.form, cg.emit(this.form, this.binding_scope))
  }
}

class RecurExpr extends ASTNode {
  constructor(form, children) {
    super(form)
    this.children = children
  }
  static from(form, analyzer) {
    let [_recur, ...args] = form
    const rhss = analyzer.analyze_forms(args)
    return analyzer.with_loop_tail((binding_forms)=>{
      if (args.length != count(binding_forms)) {
        throw(new Error(`Number of arguments in 'recur' must match number of arguments in loop head. Expected ${binding_forms.length}, got ${args.length}`))
      }
      // First assign all recur arguments to temporary vars, then reassign the
      // loop-head vars. This is because we can't yet redefine the loop head
      // vars until all the values have been computed, since those computations
      // might reference the (old value of) the loop head vars.
      const arg_syms = map((_)=>gensym("tmp"), args)
      return analyzer.with_locals(arg_syms, ()=> {
        const bindings = reduce((acc, [lhs, rhs])=>acc.concat(flatten_assignment_pair(lhs, rhs)), [], map(list, binding_forms, arg_syms))
        return new this(
          form,
          [...map((tmp, rhs)=>ConstAssignment.from(form, tmp, rhs, analyzer), arg_syms, rhss),
           ...map(([lhs, rhs])=>Reassignment.from(form, lhs, analyzer.analyze(rhs), analyzer), bindings),
           ContinueStmt]
        )
      })
    })
  }
}

class BreakStmt extends ASTNode {
  static from(form, analyzer) {
    return this
  }
  static emit(cg) {
    return cg.break_stmt()
  }
}

class ContinueStmt extends ASTNode {
  static from(form, analyzer) {
    return this
  }
  static emit(cg) {
    return cg.continue_stmt()
  }
}

class ReturnStmt extends ASTNode {
  constructor(form, expr) {
    super(form)
    this.expr = expr
  }
  static from(form, analyzer) {
    return new this(form, analyzer.analyze(form))
  }
  emit(cg) {
    return cg.return_stmt(this.form, cg.emit(this.form, this.expr))
  }
}

class ClassMethod extends ASTNode {
  constructor(form, kind, key, value, computed, is_static) {
    super(form)
    this.kind = kind
    this.key = key
    this.value = value
    this.computed = computed
    this.static = is_static
  }

  static analyze_fntail(form, fntail, analyzer) {
    // HACK: analyzed_form is needed here to unwrap the MetaExpr so we
    // get a plain FnExpr. We can't wrap a class method in a call to
    // set_meta. We do need to propagate the form meta for location
    // metadata.
    return analyzer.analyze(with_meta(list_STAR(fn_sym, fntail), meta(form))).analyzed_form
  }

  static from(form, kind, analyzer) {
    // FIXME: `this` shouldn't be implicit in methods
    return analyzer.with_locals_no_gensym([this_sym, super_sym], ()=>{
      let [fname, ... fntail] = form
      if (vector_p(fname)) {
        return new this(
          form,
          kind,
          analyzer.analyze(first(fname)),
          this.analyze_fntail(form, fntail, analyzer),
          true,
          !!get(meta(fname), static_kw)
        )
      }
      let is_valid = valid_property_name_p(fname.name)
      let is_symbol = typeof fname === 'symbol'
      let is_async = !!get(meta(fname), async_kw)
      // HACK: analyzed_form was needed here to unwrap the MetaExpr so we get a
      // plain FnExpr, but we now emit less metadata, see METAHACKS. We can't
      // wrap a class method in a call to set_meta. We do need to propagate the
      // form meta for location metadata.
      const fnexpr = analyzer.analyze(with_meta(list_STAR(fn_sym, fntail), meta(form))) //.analyzed_form,
      fnexpr.meta = meta(fname)
      return new this(
        form,
        kind,
        is_symbol ? ConstantExpr.from(fname) : is_valid ? JsIdentifierExpr.from(fname) : ConstantExpr.from(fname.name),
        fnexpr,
        is_symbol || !is_valid,
        !!get(meta(fname), static_kw)
      )
    })
  }
  emit(cg) {
    return cg.class_method(this.kind, this.key.emit(cg), this.value.emit(cg), this.computed, this.is_static)
  }
}

class ClassField extends ASTNode {
  constructor(form, key, value, is_static, computed) {
    super(form)
    this.key = key
    this.value = value
    this.static = !!is_static
    this.computed = !!computed
  }
  static from(form, analyzer) {
    let [fname, fval] = seq_p(form) ? form : [form, undefined]
    let computed = vector_p(fname)
    return new this(
      form,
      computed ? analyzer.analyze(first(fname)) :
        valid_property_name_p(fname.name) ? JsIdentifierExpr.from(fname) : ConstantExpr.from(fname.name),
      seq_p(form) ? analyzer.analyze(fval) : undefined,
      (get(meta(fname), static_kw)) || (get(meta(form), static_kw)),
      computed || !valid_property_name_p(fname.name))
  }
  emit(cg) {
    return cg.class_field(
      this.key.emit(cg),
      this.value === undefined ? undefined : this.value.emit(cg),
      this.computed, this.static)
  }
}

class StaticBlock extends ASTNode {
  constructor(form, child) {
    super(form)
    this.child = child
  }
  static from(form, analyzer) {
    return new this(form, analyzer.with_locals_no_gensym([this_sym], ()=>analyzer.analyze(form)))
  }
  emit(cg) {
    return cg.static_block(this, cg.emit(this.child, this.child))
  }
}

class ClassExpr extends ASTNode {
  constructor(form) {
    super(form)
    this.identifier = null
    this.fields = []
    this.static_blocks = []
    this.methods = []
  }

  static from(form, analyzer) {
    const self = new this(form)
    let [_class, ...more] = form
    // Class expression may or may not have a name
    if (symbol_p(more[0])) {
      let identifier = more.shift()
      analyzer.push_locals_no_gensym([identifier])
      self.identifier = JsIdentifierExpr.from(identifier)
    }
    try {
      let f = more.shift()
      while (f) {
        if (is_kw_name(f, "extends")) {
          self.superclass = analyzer.analyze(more.shift())
        } else if (is_kw_name(f, "fields")) {
          self.fields.push(... more.shift().map((f) => ClassField.from(f, analyzer)))
        } else if (is_kw_name(f, "init")) {
          self.static_blocks.push(StaticBlock.from(more.shift(), analyzer))
        } else if (is_kw_name(f, "get")) {
          self.methods.push(ClassMethod.from(more.shift(), 'get', analyzer))
        } else if (is_kw_name(f, "set")) {
          self.methods.push(ClassMethod.from(more.shift(), 'set', analyzer))
        } else if (seq_p(f)) {
          if (is_sym_name(first(f), "constructor")) {
            self.methods.push(ClassMethod.from(f, 'constructor', analyzer))
          } else {
            self.methods.push(ClassMethod.from(f, 'method', analyzer))
          }
        } else if (is_kw_name(f, "implements") || symbol_p(f)) {
          if (is_kw_name(f, "implements")) f = more.shift()
          let proto = resolve(f).value
          self.fields.push(ClassField.from(list(vector(list(symbol('.-sentinel'), f)), true), analyzer))
          let method_form
          while(seq_p(method_form = more.shift())) {
            let arity = count(second(method_form))
            let fnform = list_STAR(
              vector(list(symbol('.method_sentinel'),
                          f,
                          first(method_form).name,
                          arity)),
              rest(method_form))
            self.methods.push(ClassMethod.from(fnform, 'method', analyzer))
          }
        }
        f = more.shift()
      }
      return self
    } finally {
      if (self.identifier) {
        analyzer.pop_locals()
      }
    }
  }

  emit(cg) {
    return cg.class_expr(
      (this.identifier ? cg.emit(this.identifier, this.identifier) : null),
      (this.superclass ? cg.emit(this.superclass, this.superclass) : null),
      this.fields
        .concat(this.static_blocks)
        .concat(this.methods)
        .map((f)=>cg.emit(f, f)),
    )
  }
}

class OGetExpr extends ASTNode {
  constructor(form, o, idx) {
    super(form)
    this.o = o
    this.idx = idx
  }

  static from(form, analyzer) {
    let [_, o, idx, ...more] = form
    let node = new this(form,
                        analyzer.analyze_without_meta(o),
                          analyzer.analyze_without_meta(idx))
    while (more.length > 0) {
      let idx = more.shift()
      node = new this(form, node, analyzer.analyze_without_meta(idx))
    }
    return node
  }

  emit (cg) {
    return cg.oget(this, cg.emit(this.o, this.o), cg.emit(this.idx, this.idx))
  }
}

// Keep in sync with `special-form?` in lang.pig
let SPECIALS = {
  "fn": FnExpr,
  "def": DefExpr,
  "quote": QuoteExpr,
  "if": IfExpr,
  "defmacro": MacroVarExpr,
  // "array": ArrayExpr,
  "await": AwaitExpr,
  "new": NewExpr,
  "let": LetExpr,
  "set!": SetExpr,
  "do": DoExpr,
  "module": ModuleExpr,
  "throw": ThrowExpr,
  "var": VarExpr,
  "while": WhileExpr,
  "try": TryExpr,
  "loop": LoopExpr,
  "break": BreakStmt,
  "continue": ContinueStmt,
  "class": ClassExpr,
  "oget": OGetExpr //low level object/array accessor
}

export default class Analyzer {
  constructor() {
    this.locals_stack = [{"this":"this"}]
    this.emit_meta = true
  }

  analyze(form) {
    const expr = this.analyze_without_meta(form, this)
    if (!this.emit_meta) { return expr }
    const t = expr.constructor
    if ((VectorExpr === t ||
         DictExpr === t || QuoteExpr === t)
        && meta(form) && count(meta(form)) > 0
       ) {
      return MetaExpr.from(form, expr, this)
    }
    // if (ConstantExpr == t) {
    //   const tc = expr.form.constructor
    //   if (Keyword === tc || Symbol === tc) {
    //     return MetaExpr.from(form, expr, this)
    //   }
    // }
    return expr
  }

  /**
   * Analyze a sequence of forms, used anywhere where you have a "body" with
   * multiple forms
   */
  analyze_forms(forms) {
    return Array.from(forms || [], f=>this.analyze(f))
  }

  analyze_without_meta(form) {
    const before = form
    form = prewalk((f)=>{
      if (seq_p(f) && seq(f) && first(f) instanceof Sym && first(f).name.endsWith(".")) {
        return cons(symbol("new"), cons(symbol(first(f).toString().slice(0, -1)), rest(f)))
      }
      if (f instanceof Sym) {
        if (!(f.name.startsWith(".")) && f.name.includes(".")) {
          const parts = f.name.split(".")
          return parts.slice(1).reduce((acc, part)=>list(symbol(`.-${part}`), acc), f.with_name(parts[0]))
        }
      }
      return f
    },form)

    if (seq_p(form)) {
      if (!seq(form)) {
        return QuoteExpr.from(list(symbol("quote"), form))
      }
      const initial = first(form)
      // console.log("initial", print_str(initial))
      if (initial instanceof Sym && initial.mod == null) {
        let expr_class;
        if (expr_class = SPECIALS[initial.name]) {
          return expr_class.from(form, this)
        }
        if(initial.name in INFIX_OPERATORS && count(form) >= 3) {
          return InfixOpExpr.from(form, this)
        }
        if(initial.name in UNARY_OPERATORS) {
          return UnaryOpExpr.from(form, this)
        }
        if (initial.name.charAt(0) == ".") {
          if (initial.name.charAt(1) == "-") {
            return MemberLookupExpr.from(form, this)
          } else {
            return MethodCallExpr.from(form, this)
          }
        }
      }
      if (initial instanceof Sym || initial instanceof QSym) {
        const local = this.get_local(initial)
        if (local) {
          return InvokeExpr.from(form, this)
        }
        if (initial.name.endsWith(".")) {
          return NewExpr.from(cons(symbol("new"), cons(symbol(initial.toString().slice(0, -1)), rest(form))), this)
        }
        if (initial.pkg === PIGLET_PKG && initial.mod === "lang") {
          let expr_class;
          if (expr_class = SPECIALS[initial.name]) {
            return expr_class.from(form, this)
          }
          if(initial.name in INFIX_OPERATORS) {
            return InfixOpExpr.from(form, this)
          }
          if(initial.name in UNARY_OPERATORS) {
            return UnaryOpExpr.from(form, this)
          }
        }
        const the_var = resolve(initial)
        if (get(meta(the_var), macro_kw)) {
          const expanded = the_var(...(rest(form) || []))
          return this.analyze(expanded)
        }
        if (the_var) {
          return InvokeVarExpr.from(form, this)
        }
      }
      return InvokeExpr.from(form, this)
    }

    if (Array.isArray(form)) { // currently [...] reads as an array, that will likely change
      return VectorExpr.from(form, this)
    }

    if (dict_p(form)) {
      return DictExpr.from(form, this)
    }

    if (set_p(form)) {
      return HashSetExpr.from(form, this)
    }

    if (form instanceof Sym || form instanceof QSym) {
      if (form.mod === null) {
        const local = this.get_local(form)
        if (local) {
          return JsIdentifierExpr.from(local)
        }
        if (SpecialSymbolExpr.is_special(form.name)) {
          return SpecialSymbolExpr.from(form)
        }
      }
      if (form.pkg === null && form.mod === "js") {
        return HostVarExpr.from(form, this)
      }
      return VarLookupExpr.from(form, this)
    }

    if (form instanceof PrefixName) {
      return new ConstantExpr(Context.expand(current_context(), form))
    }

    if (form instanceof RegExp) {
      return new ConstantExpr(form)
    }

    if (form && typeof form === 'object' && !form.emit) {
      return JsObjLiteral.from(form, this)
    }

    return new ConstantExpr(form)
  }

  macroexpand(form) {
    if (seq_p(form)) {
      const initial = first(form)
      if ((initial instanceof Sym || initial instanceof QSym) && !this.get_local(initial)) {
        const the_var = resolve(initial)
        if (get(meta(the_var), macro_kw)) {
          return the_var(...(rest(form) || []))
        }
      }
    }
    return form
  }

  get_local(sym) {
    let n = sym.name
    for(var locals of this.locals_stack) {
      if(n in locals) {
        return locals[n]
      }
    }
    return false
  }

  /**
   * Push a list of local variables (symbols) onto the locals stack, so that
   * the analyzer knows that these symbols currently resolve to (JS) local
   * variables rather than piglet vars. This uses gensym to ensure locals are
   * unique in case of name reuse in nested contexts. Should be used
   * symmetrically with pop_locals to ensure a correct analyzer context.
   */
  push_locals(list) {
    this.locals_stack.unshift(Array.from(list).reduce((acc, s)=>{
      acc[s.name]=munge(gensym(s.name).name)
      // This actually mostly works, and generates _much_ nicer code, but it
      // breaks if you have e.g. two successive let blocks using the same
      // variable name, since JS won't let you have two `const` (or `let`) with
      // the same name in the same scope. Ideally we tracked which names we
      // generated in a give JS scope, but it's hard to predict where we'll
      // introduce a new IIFE to make sure we have an expression.
      //
      // if ((this.get_local(s) && !get(meta(s), "no_gensym")) || reserved_keyword_p(s.name)) {
      //   acc[s.name]=munge(gensym(s.name).name)
      // } else {
      //   acc[s.name]=munge(s.name)
      // }
      return acc
    }, Object.create(null)))
  }

  /**
   * Like [[push_locals]], but forego gensym'ing, so the symbols are used as-is.
   */
  push_locals_no_gensym(list) {
    this.locals_stack.unshift(Array.from(list).reduce((acc, s) => (acc[s.name]=munge(s.name), acc), Object.create(null)))
  }

  /**
   * Pop an entry off the locals stack. Should be called in a `finally` to
   * ensure that the analyzer doesn't get in a bad state after parse errors.
   */
  pop_locals() {
    this.locals_stack.shift()
  }

  /**
   * Get the current state of the locals stack as a value, which can be
   * restored with [[reset_locals]]
   */
  capture_locals() {
    return Array.from(this.locals_stack)
  }

  with_loop_head(binding_form, thunk) {
    const orig = this.loop_head
    this.has_loop_tail = false
    this.loop_head = [binding_form, this.capture_locals()]
    try {
      const loop_body = thunk()
      if (this.has_loop_tail) {
        this.has_loop_tail = false
        return [new WhileExpr(binding_form, new ConstantExpr(true), loop_body)]
      }
      return loop_body
    } finally {
      this.loop_head = orig
    }
  }

  with_loop_tail(thunk) {
    const [binding_form, locals_stack] = this.loop_head
    const orig_locals_stack = this.locals_stack
    this.has_loop_tail = true
    try {
      this.locals_stack = locals_stack
      return thunk(binding_form)
    } finally {
      this.locals_stack = orig_locals_stack
    }
  }

  with_locals(list, thunk) {
    this.push_locals(list)
    try {
      return thunk()
    } finally {
      this.pop_locals()
    }
  }

  with_locals_no_gensym(list, thunk) {
    this.push_locals_no_gensym(list)
    try {
      return thunk()
    } finally {
      this.pop_locals()
    }
  }
}
