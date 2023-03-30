// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Sym from "./Sym.mjs"
import List from "./List.mjs"

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
        return cg.literal(this, this.value, this.raw)
    }
}

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
let ch_slash = "/".charCodeAt(0)
let ch_semicolon = ";".charCodeAt(0)
let ch_backslash = "\\".charCodeAt(0)
let whitespace_chars = char_seq(" \r\n\t\v,")
let sym_chars = char_seq("+-_|!?$<>.*%=<>/")

class StringReader {
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
        this.pos = 0
        this.line = 0
        this.col = 0
        this.ch = this.input[this.pos]
        this.cc = this.input.charCodeAt(this.pos)
    }

    append(s) {
        const eof = this.eof()
        this.input+=s
        this.limit+=s.length
        if (eof) this.prev_ch()
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
        this.next_ch()
        this.skip_ws()
        if (this.eof()) {
            return null
        } else if ((ch_a <= this.cc && this.cc <= ch_z)
                   || (ch_A <= this.cc && this.cc <= ch_Z)
                   || sym_chars.includes(this.cc)) {
            return this.read_symbol()
        } else if (ch_0 <= this.cc && this.cc <= ch_9) {
            return this.read_number()
        } else if (this.cc == ch_lparen) {
            return this.read_list()
        } else if (this.cc == ch_dubquot) {
            return this.read_string()
        } else if (this.cc == ch_quot) {
            return new List([new Sym(null, "quote"), this.read()])
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
        let start = this.pos
        var name_start = this.pos
        var namespace = null
        while (!this.eof() &&
               (ch_a <= this.cc && this.cc <= ch_z ||
                ch_A <= this.cc && this.cc <= ch_Z ||
                ch_slash == this.cc ||
                sym_chars.includes(this.cc))) {
            if (ch_slash == this.cc) {
                namespace = this.input.substring(start, this.pos)
                name_start = this.pos+1
            }
            this.next_ch()
        }
        return new Sym(namespace, this.input.substring(name_start, this.pos))
    }

    read_list() {
        let elements = []
        while (!this.eof() && !(this.cc == ch_rparen)) {
            elements[elements.length] = this.read()
        }
        this.skip_char(ch_rparen)
        return new List(elements)
    }
}

export default StringReader
