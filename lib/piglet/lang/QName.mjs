// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert} from "./util.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import Lookup from "./protocols/Lookup.mjs"
import Named from "./protocols/Named.mjs"
import {fixed_props} from "./util.mjs"

/**
 * Fully qualified identifier
 *
 * In behavior this acts exactly as a Keyword, but instead of representing a
 * simple name, it represents a fully qualified identifier in the form of a
 * URI/IRI.
 *
 * QNames function in conjunction with the `*current-context*`. Any PrefixName
 * in source code will be expanded during compilation into a QName. Conversely
 * the printer will print out QNames as PrefixNames. In either case the context
 * is consulted to find which prefixes map to which base URLs.
 *
 * QNames are mainly modeled on RDF identifiers, but we also use QNames to
 * represent XML namespaced tags. These however are two different conceptual
 * models. In RDF a prefix+suffix are combined to form a full IRI identifier. In
 * XML the namespace and tagName are not usually combined as such, but instead
 * function more like a pair. This means that for XML applications (and other
 * places where these kind of semantics are needed) we need to track what the
 * prefix and what the suffix is, and possibly add a separator between the two,
 * because XML namespaces will often not end on a `/` or `#` but simply on an
 * alphabetic character.
 *
 * Hence why we have multiple overlapping properties here.
 * - fqn: the fully qualified name as a string, most applications will only need this
 * - base / separator / suffix: the FQN split into three parts, mainly for XML
 *
 * Whether the latter ones are all set will depend on the construction. They
 * will be if the QName originates from a PrefixName, and the use of a separator
 * can be configured via the context.
 */
export default class QName extends AbstractIdentifier {
    constructor(meta, base, separator, suffix) {
        const fqn = `${base}${separator || ""}${suffix || ""}`
        assert(fqn.includes("://"), "QName must contain '://'")
        super(meta, ":", fqn, fqn)
        fixed_props(this, {fqn: fqn, base: base, separator: separator || '', suffix: suffix || ''})
    }

    with_meta(m) {
        return new this.constructor(m, this.fqn)
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang", "qname",
            [cg.literal(this, this.base),
             cg.literal(this, this.separator),
             cg.literal(this, this.suffix)])
    }

    static parse(s) {
        return new this(null, s)
    }
}
