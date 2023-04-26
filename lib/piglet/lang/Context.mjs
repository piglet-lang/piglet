// Copyright (c) Arne Brasseur 2023. All rights reserved.

import QName from "./QName.mjs"
import PrefixName from "./PrefixName.mjs"
import {assert} from "./util.mjs"
import Lookup from "./protocols/Lookup.mjs"
import Dict from "./Dict.mjs"

export const default_prefixes = Dict.of_pairs(null, Object.entries({
    pkg: "https://vocab.piglet-lang.org/pkg/",

    dc: "http://purl.org/dc/elements/1.1/",
    dcterms: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
    org: "http://www.w3.org/ns/org#",
    owl: "http://www.w3.org/2002/07/owl#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    schema: "http://schema.org/"
}))

export default class Context {
    constructor(entries, parent_context) {
        this.entries = entries
        this.parent = parent_context
    }

    lookup(prefix) {
        return Lookup._get(this.entries, prefix) || this.parent?.lookup(prefix)
    }

    expand(prefix_name) {
        let n = prefix_name.prefix || "self"
        let expanded_prefix
        while (expanded_prefix = this.lookup(n)) {
            n = expanded_prefix
        }
        assert(n.indexOf("://") !== -1, `PrefixName did not expand to full QName, missing prefix. ${prefix_name} in ${Array.from(this.entries.keys())}`)
        return new QName(n + prefix_name.suffix)
    }

    contract(qname) {
        let prefix, suffix
        for (let [k, v] of this) {
            if (qname.fqn.startsWith(v)) {
                prefix = k
                suffix = qname.fqn.slice(v.length)
                break
            }
        }
        if (prefix && suffix) {
            return new PrefixName(prefix == 'self' ? null : prefix, suffix)
        }
        return qname
    }

    assoc(k, v) {
        return new Context(this.entries.assoc(k,v), this.parent)
    }

    dissoc(k) {
        return new Context(this.entries.dissoc(k), this.parent)
    }

    keys() {
        return [...this.entries.keys(), ...(this.parent?.keys() || [])]
    }

    values() {
        return [...this.entries.values(), ...(this.parent?.values() || [])]
    }

    [Symbol.iterator]() {
        return  [...this.entries, ...(this.parent || [])][Symbol.iterator]()
    }
}

const DEFAULT_CONTEXT = new Context(default_prefixes, null)
export {DEFAULT_CONTEXT}
