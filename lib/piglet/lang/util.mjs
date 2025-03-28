// Copyright (c) Arne Brasseur 2023. All rights reserved.

const PIGLET_PKG = "https://piglet-lang.org/packages/piglet"
export {PIGLET_PKG}

export function partition_n(n, args) {
    const partitions = []
    args = Array.from(args)
    for (let i = 0 ; i<args.length; i+=n) {
        partitions.push(args.slice(i, i+n))
    }
    return partitions
}

export function partition_n_step(n, step, args) {
    if (args === undefined) {
        return partition_n(n, step)
    }
    const partitions = []
    args = Array.from(args)
    for (let i = 0 ; (i+step)<args.length; i+=step) {
        partitions.push(args.slice(i, i+n))
    }
    return partitions
}

export function partition_all_n_step(n, step, args) {
    const partitions = []
    args = Array.from(args)
    for (let i = 0 ; i<args.length; i+=step) {
        partitions.push(args.slice(i, i+n))
    }
    return partitions
}

export function assert(bool, message) {
    if (!bool) {
        throw new Error("Assertion failed" + (message ? (", " + message) : ""))
    }
}

export function assert_type(val, type, message) {
    if (typeof type === 'string') {
        assert(typeof val === type, message || `Expected ${val?.inspect ? val.inspect() : val} (${val?.constructor?.name || typeof val}) to be of type ${type}`)
    } else {
        assert(val.constructor == type, message || `Expected ${val} (${val?.constructor?.name || typeof val}) to be of type ${type?.name}`)
    }
}

const munge_cache = {}
const unmunge_cache = {}

/**
 * Attempt at a munging strategy which yields valid JS identifiers, and
 * which is unambiguosly reversible, i.e. does not create collisions
 */
export function munge(id) {
    let munged = munge_cache[id]
    if (munged) return munged
    munged = id
        .replaceAll("$", "_$DOLLAR$_")
        // .replaceAll("_", "_$UNDERSCORE$_")
        .replaceAll("-", "_")
        .replaceAll("+", "_$PLUS$_")
        .replaceAll("<", "_$LT$_")
        .replaceAll(">", "_$GT$_")
        .replaceAll("*", "_$STAR$_")
        .replaceAll("!", "_$BANG$_")
        .replaceAll("?", "_$QMARK$_")
        .replaceAll("&", "_$AMP$_")
        .replaceAll("%", "_$PERCENT$_")
        .replaceAll("=", "_$EQ$_")
        .replaceAll("|", "_$PIPE$_")
        .replaceAll("/", "_$SLASH$_")
        .replaceAll("@", "_$AT$_")
        .replaceAll(".", "$$$$")
    // .replaceAll("ː", "_$TRICOL$_")
    // .replaceAll(":", "ː") // modifier letter triangular colon U+02D0
    munge_cache[id]=munged
    unmunge_cache[munged]=id
    return munged
}

export function unmunge(id) {
    let unmunged = unmunge_cache[id]
    if (unmunged) return unmunged
    unmunged = id
        .replaceAll("$$", ".")
        // .replaceAll("ː", ":")
        // .replaceAll("_$TRICOL$_", "ː")
        .replaceAll("_$AT$_", "@")
        .replaceAll("_$SLASH$_", "/")
        .replaceAll("_$PIPE$_", "|")
        .replaceAll("_$EQ$_", "=")
        .replaceAll("_$PERCENT$_", "%")
        .replaceAll("_$AMP$_", "&")
        .replaceAll("_$QMARK$_", "?")
        .replaceAll("_$BANG$_", "!")
        .replaceAll("_$STAR$_", "*")
        .replaceAll("_$GT$_", ">")
        .replaceAll("_$LT$_", "<")
        .replaceAll("_$PLUS$_", "+")
        .replaceAll("_", "-")
        // .replaceAll("_$UNDERSCORE$_", "_")
        .replaceAll("_$DOLLAR$_", "$")
    unmunge_cache[id]=unmunged
    munge_cache[unmunged]=id
    return unmunged
}

export function fixed_prop(o, k, v) {
    // Unfortunately defineProperty has non-negligable performance implications.
    // We'd love to make more stuff immutable, but until browsers/js-engines
    // make this faster we'll like just do a simply assignment

    // Object.defineProperty(o, k, {value: v, writable: false, enumerable: true})
    o[k]=v
    return o
}

export function fixed_props(o, kvs) {
    for (const k in kvs) {
        fixed_prop(o, k, kvs[k])
    }
    return o
}

const valid_identifier_regex = /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/
const reserved_keyword_regex = /^(do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/

export function reserved_keyword_p(n) {
    return typeof n === 'string' && reserved_keyword_regex.test(n)
}

export function valid_property_name_p(n) {
    return typeof n === 'string' && valid_identifier_regex.test(n) && !reserved_keyword_regex.test(n)
}
