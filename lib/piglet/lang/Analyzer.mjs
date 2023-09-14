// Copyright (c) Arne Brasseur 2023. All rights reserved.

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
    cons,
    conj,
    count,
    deref,
    dict,
    dict_p,
    eq,
    ensure_module,
    filter,
    first,
    gensym,
    get,
    hash_code,
    inspect,
    intern,
    keyword,
    keyword_p,
    last,
    list,
    map,
    module_registry,
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
    symbol,
    symbol_p,
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
import {PIGLET_PKG, partition_n, munge} from "./util.mjs"
import {meta, set_meta} from "./metadata.mjs"

const compiler_qsym        = qsym(`${PIGLET_PKG}:lang:*compiler*`)
const current_context_qsym = qsym(`${PIGLET_PKG}:lang:*current-context*`)
const current_module_qsym  = qsym(`${PIGLET_PKG}:lang:*current-module*`)
const first_qsym           = qsym(`${PIGLET_PKG}:lang:first`)
const get_qsym             = qsym(`${PIGLET_PKG}:lang:get`)
const intern_qsym          = qsym(`${PIGLET_PKG}:lang:intern`)
const rest_qsym            = qsym(`${PIGLET_PKG}:lang:rest`)

const quote_sym = symbol('quote')

const as_kw       = keyword("as")
const async_kw    = keyword("async")
const col_kw      = keyword("col")
const end_kw      = keyword("end")
const file_kw     = keyword("file")
const line_kw     = keyword("line")
const location_kw = keyword("location")
const macro_kw    = keyword("macro")
const or_kw       = keyword("or")
const start_kw    = keyword("start")

function current_module()  { return resolve(current_module_qsym).deref() }
function current_context() { return resolve(current_context_qsym).deref() }
function compiler()        { return resolve(compiler_qsym).deref() }

function is_sym_name(sym, name) {
    return symbol_p(sym) && sym._id_str === name
}

function is_kw_name(kw, name) {
    return keyword_p(kw) && kw._id_str === name
}

class ASTNode {
    constructor(form) {
        this.form = form
        set_meta(this, meta(form))
    }
    static from(form) {
        return new this(form)
    }
    emit(cg) {
        if (this.children) {
            let result = []
            this.children.map((c)=>{
                const estree = cg.emit(this, c)
                if (Array.isArray(estree))
                    result.push(...estree)
                else
                    result.push(estree)
            })
            return result
        }
        return cg.emit(this,this.form)
    }
}

Hashable.extend(
    ASTNode, [(function _hash_code(self) { return hash_code(self.form) })],
)

class FnExpr extends ASTNode {
    constructor(form, name, argv, body, metadata) {
        super(form)
        this.name = name
        this.argv = argv
        this.body = body
        this.meta = metadata
    }

    static from(form, analyzer) {
        let name, argv, body, metadata
        this.form = form
        let [_, x, ...rest] = form
        if (x instanceof Sym || x instanceof QSym) {
            name = x
            metadata = meta(name)
            x = rest.shift()
        }
        metadata ||= dict()
        argv = Array.from(x)
        if (meta(x)) {
            argv = set_meta(Array.from(x), meta(x))
            for (const [k, v] of meta(x)) {
                metadata = metadata.assoc(k, v)
            }
        }
        try {
            analyzer.push_locals(argv.filter((a)=>!is_sym_name(a, "&")))
            analyzer.push_locals_no_gensym(name ? [name] : [])
            body = rest.map(f=>analyzer.analyze(f))
            const lasttwo = argv.slice(-2)
            const penultimate = lasttwo && lasttwo[0]
            if (is_sym_name(penultimate, "&")) {
                argv = argv.slice(0,-2).map(analyzer.analyze_without_meta.bind(analyzer)).concat([RestExpr.from(argv.slice(-1)[0], analyzer)])
            } else {
                argv = argv.map(s=>analyzer.analyze_without_meta(s))
            }
            return new this(form, name, argv, body, metadata)
        } finally {
            analyzer.pop_locals()
            analyzer.pop_locals()
        }
    }

    emit(cg) {
        return cg.function_expr(this, {name: this.name ? cg.identifier(this.name, munge(this.name.name)) : null,
                                       argv: this.argv.map(e=>e.emit(cg)),
                                       body: this.body.map(e=>e.emit(cg)),
                                       async_p: get(meta(this.name), async_kw)
                                      })
    }
}

class ConstantExpr extends ASTNode {}

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
        return new this(form, resolve(var_sym), args.map(a=>analyzer.analyze(a)))
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
    emit(cg) {
        return cg.identifier(this, this.form)
    }
}

/**
 * [... foo]
 * We'll get rid of this, as it doesn't use seq operations
 */
class RestExpr extends ASTNode {
    constructor(form, expr) {
        super(form)
        this.expr = expr
    }
    static from(form, analyzer) {
        return new this(form, analyzer.analyze(form))
    }
    emit(cg) {
        return cg.rest_element(this, cg.emit(this, this.expr))
    }
}

/**
 * Use of a piglet var as a value in an expression
 */
class VarLookupExpr extends ASTNode {
    emit(cg) {
        return cg.var_value(this, this.form)
    }
}

/**
 * Interop method call, i.e. starts with a `.`, like `(.foo bar)`
 */
class MethodExpr extends ASTNode {
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

class MemberExpr extends ASTNode {
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
        return cg.member_lookup(this, this.object.emit(cg), this.parts)
    }
}

//////////////////////////////////////////////////////////////////////
// Destructuring

class VariableDeclaration extends ASTNode {
    constructor(form, identifier, rhs) {
        super(form)
        this.identifier = identifier
        this.rhs = rhs
    }
    emit(cg) {
        return cg.const_var_decl(this, cg.lhs(this, this.identifier), cg.emit(this, this.rhs))
    }
}

class GlobalBindingDeclaration extends ASTNode {
    constructor(form, var_sym, value, meta) {
        super(form)
        this.var_sym = var_sym
        this.value = value
        this.meta = meta
    }

    static meta_keys = [start_kw, end_kw, col_kw, line_kw, file_kw, location_kw]

    static from(form, analyzer, var_sym, rhs_form) {
        const meta_form = reduce(conj, meta(var_sym), select_keys(meta(form), this.meta_keys))
        return new this(form, var_sym, analyzer.analyze(rhs_form), analyzer.analyze_without_meta(meta_form))
    }

    emit(cg) {
        return cg.define_var(this, this.var_sym, cg.emit(this, this.value), cg.emit(this, this.meta))
    }
}

class LocalBindingDeclaration extends ASTNode {
    constructor(form, var_sym, value) {
        super(form)
        this.var_sym = var_sym
        this.value = value
    }

    static from(form, analyzer, var_sym, rhs_form) {
        return new this(form, analyzer.analyze_without_meta(var_sym), analyzer.analyze(rhs_form))
    }

    emit(cg) {
        return cg.const_var_decl(this, cg.emit(this, this.var_sym), cg.emit(this, this.value))
    }
}

class BindingDeclarator extends ASTNode {
    constructor(form, declarations, global) {
        super(form)
        this.children = declarations
        this.global = global
    }

    static from(form, binding_pair, analyzer, global) {
        const [binding, body] = binding_pair
        if (symbol_p(binding)) {
            const declarations = []
            this.analyze_binding(declarations, form, binding, analyzer.analyze(body), analyzer, global)
            return new this(
                binding_pair,
                declarations,
                global
            )
        }
        const rhs_var = gensym("destructure")
        const rhs_var_analyzed = JsIdentifierExpr.from(rhs_var.identifier_str())
        const rhs = analyzer.analyze(body)
        const declarations = [new VariableDeclaration(
            body,
            rhs_var_analyzed,
            rhs
        )]
        this.analyze_binding(declarations, form, binding, rhs_var_analyzed, analyzer, global)
        return new this(
            binding_pair,
            declarations,
            global
        )
    }

    static create_push_binding(analyzer, out, form, sym_or_identifier, rhs_form, global) {
        if (global) {
            out.push(GlobalBindingDeclaration.from(form, analyzer, sym_or_identifier, rhs_form))
        } else {
            analyzer.push_locals([sym_or_identifier])
            out.push(LocalBindingDeclaration.from(form, analyzer, sym_or_identifier, rhs_form, global))
        }
    }

    static analyze_binding(out, form, binding, body, analyzer, global) {
        if (body === undefined || body === null) {
            // TODO: possibly support unbound declarations
            throw new Error("def must be bound to a value.")
        }
        if (symbol_p(binding)) {
            const analyzed_form = analyzer.analyze(body)
            if (global) {
                out.push(GlobalBindingDeclaration.from(form, analyzer, binding, analyzed_form, global))
            } else {
                analyzer.push_locals([binding])
                out.push(LocalBindingDeclaration.from(form, analyzer, binding, analyzed_form, global))
            }
        } else if (dict_p(binding)) {
            for (let [bind, lookup] of binding) {
                if (keyword_p(bind)) {
                    if (is_kw_name(bind, "strs") || is_kw_name(bind, "keys") || is_kw_name(bind, "props") || is_kw_name(bind, "syms")) {
                        if (!sequential_p(lookup)) {
                            throw new Error("Special :strs, :keys, or :props destructuring require a sequential collection.")
                        }
                        for (let lookup_sym of lookup) {
                            if (!symbol_p(lookup_sym)) {
                                throw new Error("Special :strs, :keys, or :props destructuring require a sequential collection of symbols.")
                            }
                            let key = lookup_sym.identifier_str()
                            if (is_kw_name(bind, "keys")) {
                                key = keyword(key)
                            } else if (is_kw_name(bind, "syms")) {
                                key = list(quote_sym, lookup_sym)
                            }
                            let rhs_form = list(symbol('get'), body, key)
                            this.create_push_binding(analyzer, out, form, lookup_sym, rhs_form, global)
                        }
                    }
                } else {
                    let rhs_form = list(symbol('get'), body, lookup)
                    if (dict_p(bind) || sequential_p(bind)) {
                        this.analyze_binding(out, bind, rhs_form, analyzer, global)
                    } else {
                        this.create_push_binding(analyzer, out, form, bind, rhs_form, global)
                    }
                }
            }
        } else if (vector_p(binding)) {
            let as_binding = null
            let splat_binding = null
            let lasttwo = binding.slice(-2)
            let penultimate = lasttwo && lasttwo[0]

            if (is_kw_name(binding[0], "as")) {
                binding.shift()
                as_binding = binding.shift()
            }
            if (is_kw_name(penultimate, "as")) {
                as_binding = binding.pop()
                binding.pop()
            }
            if (as_binding) {
                if (!symbol_p(as_binding)) {
                    throw new Error(":as binding must be a symbol.")
                }
                this.create_push_binding(analyzer, out, form, as_bind, body, global)
            }
            lasttwo = binding.slice(-2)
            penultimate = lasttwo && lasttwo[0]
            if (is_sym_name(penultimate, "&")) {
                splat_binding = binding.pop()
                binding.pop()
                if (!symbol_p(splat_binding)) {
                    throw new Error("Splat binding must be a symbol.")
                }
                let rhs_form = list(symbol('drop'), binding.length, body)
                this.create_push_binding(analyzer, out, form, splat_binding, rhs_form, global)
            }
            binding.map((bind, index) => {
                let rhs_form = [...Array(index + 1).keys()].reduce((acc, i) => {
                    return i === index ? list(first_qsym, acc) : list(rest_qsym, acc)
                }, body)
                if (dict_p(bind) || sequential_p(bind)) {
                    this.analyze_binding(out, bind, rhs_form, analyzer, global, locals)
                } else {
                    this.create_push_binding(analyzer, out, form, bind, rhs_form, global)
                }
            })
        } else {
            throw new Error("Invalid def syntax")
        }
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

    static from(form, analyzer, var_sym, rhs_form) {
        const meta_form = reduce(conj, meta(var_sym) || dict(), select_keys(meta(form), this.meta_keys))
        return new this(form, var_sym, analyzer.analyze(rhs_form), analyzer.analyze_without_meta(meta_form))
    }

    emit(cg) {
        return cg.define_var(this, this.var_sym, cg.emit(this, this.value), cg.emit(this, this.meta))
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

    static from(form, analyzer, var_sym, rhs_form) {
        const rhs_expr = analyzer.analyze(rhs_form)
        analyzer.push_locals([var_sym])
        const lhs_expr = analyzer.analyze(var_sym)
        return new this(form, lhs_expr, rhs_expr)
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
}

/**
 * `let foo = ...`
 * Not calling this LetAssignment so we don't confuse it with `(let ...)`
 */
class MutableAssignment extends AssignmentBase {
    static code_gen_method = 'let_var_decl'
}

/**
 * `foo = ...`
 */
class Reassignment extends AssignmentBase {
    static code_gen_method = 'assignment'

    static from(form, analyzer, var_sym, rhs_form) {
        return new this(form, analyzer.analyze(var_sym), analyzer.analyze(rhs_form))
    }
}

/**
 * A single [lhs rhs] assignment pair, possibly with destructuring. See
 * subclasses for concrete cases.
 */
class BindingPair extends ASTNode {
    static from(pair, analyzer, Assignment) {
        const [lhs, rhs] = pair
        set_meta(pair, meta(lhs))
        const PairType = (symbol_p(lhs) ? SymbolBinding :
                          vector_p(lhs) ? VectorBinding :
                          dict_p(lhs) ? DictBinding : null)
        if (!PairType)
            throw new Error(`Left-hand side of binding pair must be symbol, vector, or dict, got ${inspect(lhs)}`)
        return PairType.from(pair, lhs, rhs, analyzer, Assignment)
    }
}

/**
 * Simple assigment like (def foo ...) or (let [foo ...]), all destructuring
 * eventually comes down to this base case.
 */
class SymbolBinding extends BindingPair {
    static from(pair, lhs, rhs, analyzer, Assignment) {
        const self = new this(pair)
        self.children = [Assignment.from(pair, analyzer, lhs, rhs)]
        return self
    }
}

/**
 * Assignment where the lhs is a vector, i.e. sequential destructuring, possibly
 * with splat (`&`) and `:as`
 */
class VectorBinding extends BindingPair {
    static find_as(lhs) {
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

    static from(pair, lhs_orig, rhs, analyzer, Assignment) {
        const self         = new this(pair)
        const carrier_sym  = gensym("seq-carrier")

        let [lhs, as_sym] = this.find_as(lhs_orig)

        analyzer.push_locals_no_gensym([carrier_sym])
        if (as_sym) analyzer.push_locals([as_sym])

        // We assign a mutable local "carrier", which is used to traverse the seq with first/rest
        // If there's an `:as` then we first assign the rhs to a constant so we can access it when
        // we encounter the `:as`
        self.children = as_sym ?
            [ConstAssignment.from(pair, analyzer, as_sym, rhs),
             MutableAssignment.from(pair, analyzer, carrier_sym, as_sym)]
            : [MutableAssignment.from(pair, analyzer, carrier_sym, rhs)]

        while (lhs) {
            if (is_sym_name(first(lhs), "&")) {
                lhs = rest(lhs) // skip &
                if (count(lhs) !== 1) {
                    throw new Error("A splat (&) in a binding form must be followed by exactly one binding form.")
                }
                self.children.push(BindingPair.from([first(lhs), as_sym], analyzer, Assignment))
            } else {
                // [carrier (rest carrier)
                //  first-lhs (first carrier)]
                self.children.push(BindingPair.from([first(lhs), list(first_qsym, carrier_sym)], analyzer, Assignment))
                if(count(lhs) > 1)
                    self.children.push(Reassignment.from(first(lhs), analyzer, carrier_sym, list(rest_qsym, carrier_sym)))
            }
            lhs = rest(lhs)
        }

        return self
    }
}

/**
 * Assignment where the lhs is a dict literal, i.e. associative destructuring,
 * supporting `:keys` / `:syms` / `:strs`
 */
class DictBinding extends BindingPair {
    static from(pair, lhs, rhs, analyzer, Assignment) {
        const self   = new this(pair)
        const as_sym = lhs.get(as_kw, gensym("dict-as"))
        const or_dict = lhs.get(or_kw, dict())

        analyzer.push_locals([as_sym])
        self.children = [ConstAssignment.from(pair, analyzer, as_sym, rhs)]
        lhs = lhs.dissoc(as_kw).dissoc(or_kw)

        const push_const_binding = (lhs, rhs) => {
            if (!symbol_p(lhs)) throw new Error(`Dict destructuring, expected symbols, got ${inspect(lhs)}.`)
            analyzer.push_locals([lhs])
            self.children.push(ConstAssignment.from(lhs, analyzer, lhs, list(get_qsym, as_sym, rhs, or_dict.get(lhs))))
        }

        for (const [k, v] of lhs) {
            if (k instanceof Keyword) {
                if (!vector_p(v)) throw new Error(`Dict destructuring ${k}, expected vector value, got ${inspect(v)}.`)
                for (const sym of v) {
                    push_const_binding(sym,
                                       k.name === "strs" ? sym.name
                                       : k.name === "keys" ? keyword(sym.name)
                                       : k.name === "syms" ? list(quote_sym, symbol(sym.name))
                                       : (()=>{throw new Error(`Dict destructuring, expected :keys, :strs, or :syms. Got ${k}.`)})())

                }
            } else if (k instanceof PrefixName) {
            } else if (k instanceof QName) {
            } else if (k instanceof QSym) {
            } else {
                self.children.push(BindingPair.from([k, list(get_qsym, as_sym, v)], analyzer, Assignment))
            }
        }
        return self
    }
}

export {BindingPair, VarAssignment, ConstAssignment, MutableAssignment}

//////////////////////////////////////////////////////////////////////
// Binding contexts

class DefExpr extends ASTNode {
    constructor(form, bind_expr) {
        super(form)
        this.bind_expr = bind_expr
    }
    static from(form, analyzer) {
        const [_def, binding, body] = form
        const binding_pair = [binding, body]
        const declarator = BindingPair.from(binding_pair, analyzer, VarAssignment)
        return new this(form, declarator)
    }

    emit(cg) {
        return cg.emit(this, this.bind_expr)
    }

}

class LetExpr extends ASTNode {
    constructor(form, children) {
        super(form)
        this.children = children
    }
    static from(form, analyzer) {
        let [_, bindings, ...body] = form
        const out = []
        if (count(bindings) % 2 !== 0) {
            throw new Error("Invalid let: binding vector requires even number of forms")
        }
        const binding_pairs = partition_n(2, bindings)
        let declarator;
        let locals_stack = analyzer.capture_locals()
        binding_pairs.map(binding_pair => {
            out.push(BindingPair.from(binding_pair, analyzer, ConstAssignment))
        })
        if (!(seq(body))) {
            body = [Sym.parse("nil")]
        }
        out.push(...body.map(e=>analyzer.analyze(e)))
        analyzer.reset_locals(locals_stack)
        return new this(form, out)
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
        let [_defmacro, var_sym, argv, ...rest] = form
        current_module().intern(var_sym.name, null, Object.assign({macro: true}, meta(var_sym)))
        argv = Array.from(argv)
        try {
            analyzer.push_locals(argv.filter((a)=>!is_sym_name(a, "&")))
            const body = rest.map(f=>analyzer.analyze(f))
            const lasttwo = argv.slice(-2)
            const penultimate = lasttwo && lasttwo[0]
            if (is_sym_name(penultimate, "&")) {
                argv = argv.slice(0,-2).map(s=>analyzer.analyze_without_meta(s)).concat([RestExpr.from(argv.slice(-1)[0], analyzer)])
            } else {
                argv = argv.map(s=>analyzer.analyze_without_meta(s))
            }
            return new this(form, var_sym, argv, body)
        } finally {
            analyzer.pop_locals()
        }
    }
    emit(cg) {
        return cg.define_var(
            this,
            this.var_sym,
            cg.function_expr(
                this,
                {name: this.name,
                 argv: this.argv.map(e=>e.emit(cg)),
                 body: this.body.map(e=>e.emit(cg))}),
            cg.emit(this, Associative._assoc(meta(this.var_sym), macro_kw, true)))
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
            else_branch ? analyzer.analyze(else_branch) : null
        )
    }
    emit(cg) {
        return cg.conditional(this, this.test.emit(cg), this.if_branch.emit(cg), this.else_branch?.emit(cg))
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
    "instance?": "instanceof",
    "and": "&&",
    "or": "||",
    "bit-shift-left": "<<",
    "bit-shift-right": ">>",
    "bit-and": "&",
    "bit-or": "|",
    "bit-xor": "^",
}

const BOOLEAN_INFIX_OPERATORS = ["<", ">", "<=", ">=", "==", "===", "instanceof", "&&", "||"]

const UNARY_OPERATORS = {
    "typeof": "typeof",
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
        if (this.op === 'instanceof') {
            return cg.infix_op(this, this.op, this.args.reverse().map(a=>cg.emit(this,a)))
        }
        if (BOOLEAN_INFIX_OPERATORS.includes(this.op)) {
            return cg.boolean_infix_op(this, this.op, this.args.map(a=>cg.emit(this,a)))
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
            Array.from(Object.entries(form)).reduce((acc, [k, v])=>(acc[k]=analyzer.analyze(v), acc), {})
        )
    }
    emit(cg) {
        return cg.object_literal(this, Object.entries(this.obj).map(([k, v]) => [cg.emit(k, k), cg.emit(v, v)], {}))
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
    static from(form, analyzer) {
        const [_, ...rest] = form
        return new this(form, rest.map((f)=>analyzer.analyze(f)))
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
        try {
            analyzer.push_locals([interned_mod.self_ref])
            const analyze = analyzer.analyze.bind(analyzer)
            const self = interned_mod.self_ref
            const children = [
                (new VariableDeclaration(
                    this,
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
                    ))),

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
                    return analyze(list(symbol('await'), list(symbol('piglet:lang:require'), list(symbol("quote"), from.fqn))))
                })),
                self
            ]
            return new this(form, children)
        } finally {
            analyzer.pop_locals()
        }
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
        return cg.while_stmt(this, this.test, this.body)
    }
}

class MetaExpr extends ASTNode {
    constructor(form, analyzed_form, meta) {
        super(form)
        this.analyzed_form = analyzed_form
        this.meta = meta
    }
    static from(form, analyzed_form, analyzer) {
        const meta_form = meta(form)
        if (meta_form == null) {
            return analyzed_form
        }
        analyzer.emit_meta = false
        const meta_expr = analyzer.analyze(meta_form)
        analyzer.emit_meta = true
        return new this(form, analyzed_form, meta_expr)
    }
    emit(cg) {
        return cg.wrap_set_meta(
            cg.emit(this.form, this.analyzed_form),
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
        let catch_form, catch_arg, catch_body, finalizer_form, finalizer_body, body, f
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
            analyzer.push_locals([catch_arg])
            catch_arg = analyzer.analyze_without_meta(catch_arg)
            catch_body = analyzer.analyze_forms(rest(f))
            analyzer.pop_locals([catch_arg])
        }
        body = analyzer.analyze_forms(body)
        return new this(form, body,
                        catch_form, catch_arg, catch_body,
                        finalizer_form, finalizer_body)
    }
    emit(cg) {
        return cg.try_stmt(this.form, this.body,
                           this.catch_form, this.catch_arg, this.catch_body,
                           this.finalizer_form, this.finalizer_body)
    }
}

let SPECIALS = {
    "fn*": FnExpr,
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
    "try": TryExpr
}

export default class Analyzer {
    constructor() {
        this.locals_stack = []
        this.emit_meta = true
    }

    analyze(form) {
        const expr = this.analyze_without_meta(form, this)
        if (!this.emit_meta) { return expr }
        const t = expr.constructor
        if (VectorExpr === t || DictExpr === t || QuoteExpr === t) {
            return MetaExpr.from(form, expr, this)
        }
        // if (ConstantExpr == t) {
        //     const tc = expr.form.constructor
        //     if (Keyword === tc || Symbol === tc) {
        //         return MetaExpr.from(form, expr, this)
        //     }
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
                        return MemberExpr.from(form, this)
                    } else {
                        return MethodExpr.from(form, this)
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
                    return (this.analyze(expanded))
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
        this.locals_stack.unshift(Array.from(list).reduce((acc, s) => (acc[s.name]=munge(gensym(s.name).name), acc), {}))
    }

    /**
     * Like [[push_locals]], but forego gensym'ing, so the symbols are used as-is.
     */
    push_locals_no_gensym(list) {
        this.locals_stack.unshift(Array.from(list).reduce((acc, s) => (acc[s.name]=munge(s.name), acc), {}))
    }

    /**
     * Pop an entry off the locals stack.
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

    /**
     * Discard the current state of the locals stack, replacing it with the
     * given value, which presumably came from [[capture_locals]]
     */
    reset_locals(locals_stack) {
        this.locals_stack = locals_stack
    }
}
