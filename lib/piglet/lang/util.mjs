// Copyright (c) Arne Brasseur 2023. All rights reserved.

export function partition_n(n, args) {
    const partitions = []
    for (let i = 0 ; i<args.length; i+=n) {
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
        assert(typeof val === type, message || "Expected " + JSON.stringify(val) + " to be of type " + type)
    } else {
        assert(val.constructor == type, message || "Expected " + JSON.stringify(val) + " to be of type " + type)
    }
}

/**
 * Attempt at a munging strategy which yields valid JS identifiers, and
 * which is unambiguosly reversible, i.e. does not create collisions
 */
export function munge(id) {
    return id
        .replaceAll("$", "_$DOLLAR$_")
        .replaceAll("_", "_$UNDERSCORE$_")
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
        .replaceAll(".", "$$$$")
    // .replaceAll("ː", "_$TRICOL$_")
    // .replaceAll(":", "ː") // modifier letter triangular colon U+02D0
}

export function unmunge(id) {
    return id
        .replaceAll("$$", ".")
    // .replaceAll("ː", ":")
    // .replaceAll("_$TRICOL$_", "ː")
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
        .replaceAll("_$UNDERSCORE$_", "_")
        .replaceAll("_$DOLLAR$_", "$")
}