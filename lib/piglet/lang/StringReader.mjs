// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import List from "./List.mjs"
import {QName, PrefixName} from "./QName.mjs"
import {keyword} from "./Keyword.mjs"
import {extend_class} from "./Protocol.mjs"
import {assert} from "./util.mjs"

/**
 * Wrapper for primitive values, so we can store location information on them.
 */
class Primitive {
    constructor(raw, value) {
        this.raw = raw
        this.value = value
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

class ArrayPrimitive extends Primitive {
    emit(cg) {
        return cg.array_literal(this, this.value.map(v=>cg.emit(this, v)))
    }

    [Symbol.iterator]() {
        return this.value[Symbol.iterator]()
    }
}

extend_class(
    Primitive,
    "piglet:lang/Repr",
    [function _repr(self) {return self.raw}])

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
let ch_dubquot = "\"".charCodeAt(0)
let ch_quot = "'".charCodeAt(0)
let ch_lparen = "(".charCodeAt(0)
let ch_rparen = ")".charCodeAt(0)
let ch_lbracket = "[".charCodeAt(0)
let ch_rbracket = "]".charCodeAt(0)
let ch_slash = "/".charCodeAt(0)
let ch_colon = ":".charCodeAt(0)
let ch_semicolon = ";".charCodeAt(0)
let ch_backslash = "\\".charCodeAt(0)
let whitespace_chars = char_seq(" \r\n\t\v,")
let sym_chars = char_seq("+-_|!?$<>.*%=<>/:")

export class PartialParse extends Error {}

export default class StringReader {
    constructor(input) {
        this.input = input
        this.pos = -1
        this.limit = input.length
        this.line = 0
        this.col = -1
        this.ch = null
        this.cc = null
    }

    eof() {
        return this.limit <= this.pos
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
        this.pos--
        this.col--
        this.ch = this.input[this.pos]
        this.cc = this.input.charCodeAt(this.pos)
    }

    reset() {
        this.pos = -1
        this.line = 0
        this.col = -1
        this.ch = null
        this.cc = null
    }

    append(s) {
        const eof = this.eof()
        this.input+=s
        this.limit+=s.length
        if (eof) this.prev_ch()
    }

    truncate() {
        this.input = this.input.slice(this.pos)
        this.pos = 0
        this.line = 0
        this.col = 0
        this.limit = this.input.length
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

    skip_char(cc) {
        if (this.eof()) {
            throw new PartialParse()
        }
        if (this.cc !== cc) {
            throw new Error("Unexpected input " + this.ch + ", expected " + String.fromCodePoint(cc))
        }
        this.next_ch()
    }

    skip_comment() {
        if (this.eof()) return
        while (this.cc != 10) {
            this.next_ch()
        }
        this.line++
        this.col = 0
    }

    _read() {
        if (this.pos === -1) {
            this.next_ch()
        }
        this.skip_ws()
        if (this.eof()) {
            return null
        } else if (this.cc == ch_colon) {
            return this.read_name()
        } else if ((ch_a <= this.cc && this.cc <= ch_z)
                   || (ch_A <= this.cc && this.cc <= ch_Z)
                   || sym_chars.includes(this.cc)) {
            return this.read_symbol()
        } else if (ch_0 <= this.cc && this.cc <= ch_9) {
            return this.read_number()
        } else if (this.cc == ch_lbracket) {
            return this.read_vector()
        } else if (this.cc == ch_lparen) {
            return this.read_list()
        } else if (this.cc == ch_dubquot) {
            return this.read_string()
        } else if (this.cc == ch_quot) {
            this.next_ch()
            return new List([new Sym(null, null, "quote"), this.read()])
        } else if (this.cc == ch_semicolon) {
            this.skip_comment()
            return this._read()
        }
        return "not recognized " + this.ch + " @" + this.pos
    }

    read() {
        let start = this.pos
        let col = this.col
        let line = this.line

        let expr = this._read()
        if (expr) {
            expr.start = start
            expr.end = this.pos
            expr.col = col
            expr.line = line

            return expr
        }
        return expr
    }

    read_number() {
        const start = this.pos
        while (!this.eof() && (ch_0 <= this.cc && this.cc <= ch_9)) this.next_ch()
        const num_str = this.input.substring(start, this.pos)
        return new Primitive(num_str, parseInt(num_str, 10))
    }

    read_string() {
        let start = this.pos
        this.next_ch()
        while (!this.eof() && ch_dubquot != this.cc) {
            this.next_ch()
            if (ch_backslash == this.cc) {
                this.next_ch()
            }
        }
        this.skip_char(ch_dubquot)
        let str = this.input.substring(start, this.pos)
        // FIXME: get rid of the eval
        return new Primitive(str, eval(str))
    }

    read_symbol() {
        const start = this.pos
        let part_start = this.pos
        let parts = []
        while (!this.eof() &&
               (ch_a <= this.cc && this.cc <= ch_z ||
                ch_A <= this.cc && this.cc <= ch_Z ||
                ch_0 <= this.cc && this.cc <= ch_9 ||
                ch_slash == this.cc ||
                sym_chars.includes(this.cc))) {
            if (ch_colon == this.cc) {
                parts.push(this.input.substring(part_start, this.pos))
                part_start = this.pos+1
            }
            this.next_ch()
        }
        parts.push(this.input.substring(part_start, this.pos))
        assert(parts.length <= 3)
        for(let i = parts.length; i<3 ; i++) {
            parts.unshift(null)
        }
        return new Sym(...parts)
    }

    read_sequence(end_ch) {
        const elements = []
        this.next_ch()
        while (!this.eof() && !(this.cc == end_ch)) {
            elements[elements.length] = this.read()
            this.skip_ws()
        }
        this.skip_char(end_ch)
        return elements
    }

    read_list() {
        return new List(this.read_sequence(ch_rparen))
    }

    read_vector() {
        const elements = this.read_sequence(ch_rbracket)
        return new ArrayPrimitive(JSON.stringify(elements), elements)
    }

    read_name() {
        this.next_ch()
        if (this.cc === ch_colon) {
            this.next_ch()
            const s = this.read_symbol()
            assert(!s.mod)
            return new PrefixName(null, s.name)
        }
        let s = (this.cc == this.ch_dubquot) ? this.read_string() : this.read_symbol().repr()
        if (s.includes("://")) return new QName(s)
        if (s.includes(":")) return PrefixName.parse(s)
        return keyword(s)
    }
}
