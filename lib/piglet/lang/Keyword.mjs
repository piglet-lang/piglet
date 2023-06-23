// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {meta, set_meta} from "./metadata.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"
import {assert, assert_type} from "./util.mjs"

export default class Keyword extends AbstractIdentifier {
    constructor(meta, name) {
        assert_type(name, String, `Expected String name, got ${name.description}`)
        super(meta, ":", name, name)
    }

    with_meta(m) {
        return new this.constructor(m, this.name)
    }

    eq(other) {
        return (other instanceof Keyword) && this.name === other.name
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "piglet", "lang",
            "keyword",
            (meta(this) ? [this.name, meta(this)] : [this.name]).map(s=>cg.literal(this, s)))
    }
}

export function keyword(name, meta) {
    return new Keyword(meta, name)
}
