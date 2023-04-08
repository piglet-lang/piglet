// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {extend_class, invoke_proto} from "./Protocol.mjs"

export default class Keyword {
    constructor(name, meta) {
        this.name = name
        this.meta = meta
    }

    repr() {
        return ":" + this.name
    }

    eq(other) {
        return (other instanceof Keyword) && this.name === other.name
    }

    emit(cg) {
        return cg.invoke_var(
            this,
            "bunny", "lang",
            "keyword",
            (this.meta ? [this.name, this.meta] : [this.name]).map(s=>cg.literal(this, s)))
    }
}

export function keyword(name) {
    return new Keyword(name)
}

extend_class(
    Keyword,
    "bunny:lang/Repr",
    [function _repr(self) {return self.repr()}])
