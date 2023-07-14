// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import List from "./List.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import Dict, {dict} from "./Dict.mjs"
import HashSet, {set} from "./HashSet.mjs"
import QName from "./QName.mjs"
import QSym from "./QSym.mjs"
import PrefixName from "./PrefixName.mjs"
import Keyword, {keyword} from "./Keyword.mjs"
import {assert} from "./util.mjs"
import Repr from "./protocols/Repr.mjs"
import WithMeta from "./protocols/WithMeta.mjs"
import Associative from "./protocols/Associative.mjs"
import {meta, set_meta, has_meta} from "./metadata.mjs"

const NO_READ=Symbol("NO_READ")

/**
 * Wrapper for primitive values, so we can store location information on them.
 */
// FIXME get rid of these, just use JS wrapper objects and set metadata on them
class Primitive {
    constructor(raw, value) {
        this.raw = raw
        this.value = value
    }

    repr() {
        return this.raw
    }

    toString() {
        return this.raw
    }

    emit(cg) {
        if (Array.isArray(this.value)) {
            return cg.array_literal(this, this.value.map(v=>cg.emit(this, v)))
        }
        return cg.literal(this, this.value, this.raw)
    }

    [Symbol.valueOf]() {
        return this.value
    }
}

Repr.extend(Primitive, [function _repr(self) { return self.repr() }])

function char_seq(s) {
    return s.split("").map(ch=>ch.charCodeAt(0))
}

function char_code(s) {
    return s.charCodeAt(0)
}

let ch_0 = "0".charCodeAt(0)
let ch_9 = "9".charCodeAt(0)
let ch_a = "a".charCodeAt(0)
let ch_z = "z".charCodeAt(0)
let ch_A = "A".charCodeAt(0)
let ch_Z = "Z".charCodeAt(0)
let ch_caret = "^".charCodeAt(0)
let ch_dash = "-".charCodeAt(0)
let ch_underscore = "_".charCodeAt(0)
let ch_dubquot = "\"".charCodeAt(0)
let ch_quot = "'".charCodeAt(0)
let ch_hash = "#".charCodeAt(0)
let ch_lparen = "(".charCodeAt(0)
let ch_rparen = ")".charCodeAt(0)
let ch_lbracket = "[".charCodeAt(0)
let ch_rbracket = "]".charCodeAt(0)
let ch_lbrace = "{".charCodeAt(0)
let ch_rbrace = "}".charCodeAt(0)
let ch_slash = "/".charCodeAt(0)
let ch_colon = ":".charCodeAt(0)
let ch_at = "@".charCodeAt(0)
let ch_semicolon = ";".charCodeAt(0)
let ch_backslash = "\\".charCodeAt(0)
let ch_period = ".".charCodeAt(0)
let whitespace_chars = char_seq(" \r\n\t\v,")
let sym_chars = char_seq("+-_|!?$<>.*%=<>/:&#")
let ch_backtick = "`".charCodeAt(0)
let ch_tilde = "~".charCodeAt(0)

export class PartialParse extends Error {}

export default class StringReader {
    constructor(input, filename) {
        this.input = input
        this.filename = filename
        this.pos = -1
        this.limit = input.length
        this.line = 0
        this.col = -1
        this.ch = null
        this.cc = null
        this.meta_stack = []
        this.line_offset = 0
        this.start_offset = 0
    }

    eof() {
        return this.limit <= this.pos || this.limit === 0
    }

    next_ch(should_throw) {
        if (this.eof()) {
            if (should_throw) {
                throw new Error("Unexpected end of input")
            } else {
                return
            }
        }
        this.pos++
        this.col++
        this.ch = this.input[this.pos]
        this.cc = this.input.charCodeAt(this.pos)
    }

    prev_ch() {
        if (this.pos > -1) {
            this.pos--
            this.col--
            this.ch = this.input[this.pos]
            this.cc = this.input.charCodeAt(this.pos)
        }
    }

    reset() {
        this.pos = -1
        this.line = 0
        this.col = -1
        this.limit = this.input.length
        this.ch = null
        this.cc = null
    }

    append(s) {
        const eof = this.eof()
        this.input+=s
        this.limit+=s.length
        if (eof) this.prev_ch()
    }

    empty() {
        this.input = ""
        this.pos = 0
        this.line = 0
        this.col = 0
        this.limit = 0
        this.ch = null
        this.cc = null
    }

    truncate() {
        this.input = this.input.slice(this.pos)
        this.pos = 0
        this.line = 0
        this.col = 0
        this.limit = this.input.length
    }

    skip_char(cc) {
        if (this.eof()) {
            throw new PartialParse()
        }
        if (this.cc !== cc) {
            throw new Error("Unexpected input " + this.ch + ", expected " + String.fromCodePoint(cc))
        }
        this.next_ch()
    }

    skip_ws() {
        if (this.eof()) return
        while (whitespace_chars.includes(this.cc)) {
            if (this.cc === 10) {
                this.line++
                this.col = 0
            }
            this.next_ch()
        }
    }

    skip_comment() {
        if (this.eof()) return
        while (this.cc != 10) {
            this.next_ch()
        }
        this.line++
        this.col = 0
    }

    skip_blank() {
        this.skip_ws()
        while (!this.eof() && this.cc === ch_semicolon) {
            this.skip_comment()
            this.skip_ws()
        }
    }

    _read() {
        if (this.pos === -1) {
            this.next_ch()
        }
        this.skip_blank()
        if (this.eof()) {
            return null
        } else if (this.cc === ch_caret) {
            this.next_ch()
            let next_meta = this.meta_stack[0]
            const new_meta = this._read()
            if (new_meta instanceof Sym) {
                next_meta = Associative._assoc(next_meta, keyword("tag"), new_meta)
            } else if (new_meta instanceof Keyword) {
                next_meta = Associative._assoc(next_meta, new_meta, true)
            } else if (new_meta instanceof Dict) {
                next_meta = Array.from(new_meta).reduce((acc, [k, v])=>Associative._assoc(acc, k, v), next_meta)
            }
            this.meta_stack[0] = next_meta
            return this._read()
        } else if (this.cc === ch_hash) {
            this.next_ch()
            if (this.cc === ch_underscore) {
                this.next_ch()
                this.read()
                return NO_READ
            } else if (this.cc === ch_lbrace) {
                return this.read_set()
            } else {
                const sym = this.read_symbol()
                if (sym.toString() === "js") {
                    const val = this._read()
                    if (val instanceof Dict) {
                        const ret = {}
                        for (let [k, v] of val) {
                            ret[k instanceof AbstractIdentifier ? k.identifier_str() : k] = v
                        }
                        return ret
                    }
                    if (Array.isArray(val)) {
                        // FIXME: will have to change once we have real vectors
                        return val
                    }
                }
                throw new Error(`Unsupported reader dispatch #${this.ch}`)
            }
        } else if (this.cc === ch_colon) {
            return this.read_name()
        } if (ch_0 <= this.cc && this.cc <= ch_9) {
            return this.read_number()
        } else if (ch_dash === this.cc) {
            this.next_ch()
            if (ch_0 <= this.cc && this.cc <= ch_9) {
                this.prev_ch()
                return this.read_number()
            } else {
                this.prev_ch()
                return this.read_symbol()
            }
        } else if ((ch_a <= this.cc && this.cc <= ch_z)
                   || (ch_A <= this.cc && this.cc <= ch_Z)
                   || sym_chars.includes(this.cc)) {
            return this.read_symbol()
        } else if (this.cc === ch_lparen) {
            return this.read_list()
        } else if (this.cc === ch_lbracket) {
            return this.read_vector()
        } else if (this.cc === ch_lbrace) {
            return this.read_dict()
        } else if (this.cc === ch_dubquot) {
            return this.read_string()
        } else if (this.cc === ch_quot) {
            this.next_ch()
            return new List([new Sym(null, null, "quote"), this.read()])
        } else if (this.cc === ch_at) {
            this.next_ch()
            return new List([new Sym(null, null, "deref"), this.read()])
        } else if (this.cc === ch_semicolon) {
            this.skip_comment()
            return this._read()
        } else if (this.cc === ch_backtick) {
            this.next_ch()
            return new List([new Sym(null, null, "syntax-quote"), this.read_with_meta()])
        } else if (this.cc === ch_tilde) {
            this.next_ch()
            if (this.cc === ch_at) {
                this.next_ch()
                return new List([new Sym(null, null, "unquote-splice"), this.read_with_meta()])
            }
            return new List([new Sym(null, null, "unquote"), this.read_with_meta()])
        }
        throw new Error(`not recognized ${this.ch}  @${this.pos}`)
    }

    read_with_meta() {
        let start = this.pos + this.start_offset + 1
        let col = this.col+1
        let line = this.line + this.line_offset
        this.meta_stack.unshift(dict(
            keyword("start"), start,
            keyword("col"), col,
            keyword("line"), Math.max(line,1),
        ))
        if (this.filename) {
            this.meta_stack.unshift(
                Associative._assoc(this.meta_stack.shift(), keyword("file"), this.filename))

        }
        let expr = this._read()
        if (expr === NO_READ) {
            this.meta_stack.shift()
            return NO_READ;
        }
        if (expr && (typeof expr === 'object' || typeof expr === 'function')) {
            const m = Associative._assoc(this.meta_stack.shift(), keyword("end"), this.pos)
            if (WithMeta.satisfied(expr)) {
                expr = WithMeta._with_meta(expr, m)
            } else if (expr && typeof expr === 'object') {
                if (has_meta(expr)) {
                } else {
                    set_meta(expr, m)
                }
            }
        } else {
            this.meta_stack.shift()
        }
        return expr
    }

    read() {
        const expr = this.read_with_meta()
        if (expr === NO_READ) return null
        return expr
    }

    read_number() {
        const start = this.pos
        if (ch_dash === this.cc) this.next_ch()
        while (!this.eof() && (ch_0 <= this.cc && this.cc <= ch_9)) this.next_ch()
        if (!this.eof() && this.cc === ch_period) {
            this.next_ch()
            while (!this.eof() && (ch_0 <= this.cc && this.cc <= ch_9)) this.next_ch()
            const num_str = this.input.substring(start, this.pos)
            return parseFloat(num_str, 10)
        }
        const num_str = this.input.substring(start, this.pos)
        return parseInt(num_str, 10) // new Primitive(num_str, parseInt(num_str, 10))
    }

    read_string() {
        let start = this.pos
        let result = ""
        this.next_ch()
        while (!this.eof() && ch_dubquot != this.cc) {
            if (ch_backslash === this.cc) {
                this.next_ch(true)
                if (this.ch === "n") {
                    result = `${result}\n`
                } else if (this.ch === "t") {
                    result = `${result}\t`
                } else if (this.ch === "u") {
                    this.next_ch(true)
                    let ustart = this.pos
                    let uhex = null
                    if (this.ch === "{") {
                        ustart += 1
                        while (this.ch != "}") { this.next_ch(true) }
                        uhex = this.input.slice(ustart, this.pos)
                    } else {
                        this.next_ch(true)
                        this.next_ch(true)
                        this.next_ch(true)
                        uhex = this.input.slice(ustart, this.pos+1)
                    }
                    result += String.fromCodePoint(parseInt(uhex, 16))
                } else {
                    result = `${result}${this.ch}`
                }
                this.next_ch()
            } else {
                result = `${result}${this.ch}`
                this.next_ch()
            }
        }
        this.skip_char(ch_dubquot)
        return result
    }

    read_symbol() {
        const start = this.pos
        while (!this.eof() &&
               (ch_a <= this.cc && this.cc <= ch_z ||
                ch_A <= this.cc && this.cc <= ch_Z ||
                ch_0 <= this.cc && this.cc <= ch_9 ||
                ch_slash === this.cc ||
                ch_at === this.cc || // @ allowed as non-initial
                sym_chars.includes(this.cc))) {
            this.next_ch()
        }
        const s = this.input.substring(start, this.pos)
        if (s.includes("://")) {
            return QSym.parse(s)
        }
        return Sym.parse(s)
    }

    read_sequence(end_ch) {
        const elements = []
        this.next_ch()
        this.skip_blank()
        while (!this.eof() && !(this.cc === end_ch)) {
            const el = this.read_with_meta()
            if (el !== NO_READ) {
                elements[elements.length] = el
            }
            this.skip_blank()
        }
        this.skip_char(end_ch)
        return elements
    }

    read_list() {
        return new List(this.read_sequence(ch_rparen))
    }

    read_vector() {
        // currently just returns an Array
        return this.read_sequence(ch_rbracket)
    }

    read_dict() {
        const kvs = this.read_sequence(ch_rbrace)
        return dict(...kvs)
    }

    read_set() {
        const vals = this.read_sequence(ch_rbrace)
        return HashSet.of(null, ...vals)
    }

    read_name() {
        this.next_ch()
        if (this.cc === ch_colon) {
            this.next_ch()
            const s = this.read_symbol()
            assert(!s.mod)
            return new PrefixName(null, null, s.name)
        }
        let s = (this.cc === this.ch_dubquot) ? this.read_string() : this.read_symbol().toString()
        if (s.includes("://")) return new QName(null, s)
        if (s.includes(":")) return PrefixName.parse(s)
        return keyword(s)
    }
}
