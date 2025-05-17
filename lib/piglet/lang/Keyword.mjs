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
            [cg.emit(this, this.name)
                // , cg.emit(this, meta(this))
            ]
        )
    }
}

const kw_cache = new Object(null)

export function keyword(name, meta) {
  if (!meta)
    return kw_cache[name]||=new Keyword(meta || null, name)
  return new Keyword(meta || null, name)
}
