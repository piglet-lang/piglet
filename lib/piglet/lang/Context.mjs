// Copyright (c) Arne Brasseur 2023. All rights reserved.

import QName from "./QName.mjs"
import PrefixName from "./PrefixName.mjs"
import {keyword} from "./Keyword.mjs"
import {assert} from "./util.mjs"
import Lookup from "./protocols/Lookup.mjs"
import Dict from "./Dict.mjs"
import {meta} from "./metadata.mjs"

export const default_prefixes = Dict.of_pairs(null, Object.entries({
    pkg: "https://vocab.piglet-lang.org/package/",
    dc: "http://purl.org/dc/elements/1.1/",
    dcterms: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
    org: "http://www.w3.org/ns/org#",
    owl: "http://www.w3.org/2002/07/owl#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    schema: "http://schema.org/",
    xsd: Dict.of_pairs(null, [[keyword("base"), "http://www.w3.org/2001/XMLSchema"],
                              [keyword("separator"), "#"]]),
    svg: Dict.of_pairs(null, [[keyword("base"), "http://www.w3.org/2000/svg"],
                              [keyword("separator"), "#"]]),
    xhtml: Dict.of_pairs(null, [[keyword("base"), "http://www.w3.org/1999/xhtml"],
                                [keyword("separator"), "#"]])
}))

export default class Context {
    constructor() {
        throw new Error("Context is not constructible")
    }

    static expand(ctx, prefix_name) {
        let base = prefix_name.prefix || "self"
        let separator = ""
        let expanded_prefix
        let suffix
        if (default_prefixes.get(base)) {
            base = default_prefixes.get(base)
        } else {
            while (expanded_prefix = ctx.get(base instanceof Dict ? base.get(keyword("base")) : base)) {
                base = expanded_prefix
            }
        }
        [base, separator] = (base instanceof Dict ?
                             [base.get(keyword("base")), base.get(keyword("separator"))] :
                             [base, ""]
                            )
        assert(base.indexOf("://") !== -1, `PrefixName did not expand to full QName, missing prefix. ${prefix_name} in ${ctx}`)
        return new QName(meta(prefix_name), base, separator || "", prefix_name.suffix)
    }

    static contract(ctx, qname) {
        let prefix, suffix
        for (let [k,v] of default_prefixes) {
            if (v instanceof Dict) {
                v = v.get(keyword('base'))
            }
            if (qname.fqn.startsWith(v)) {
                prefix = k
                suffix = qname.fqn.slice(v.length)
                return new PrefixName(meta(qname), prefix == 'self' ? null : prefix, suffix)
            }
        }

        for (const [k, v] of ctx) {
            if (v instanceof Dict) {
                v = v.get(keyword('base'))
            }
            if (qname.fqn.startsWith(v)) {
                prefix = k
                suffix = qname.fqn.slice(v.length)
                return new PrefixName(meta(qname), prefix == 'self' ? null : prefix, suffix)
            }
        }

        return qname
    }
}
