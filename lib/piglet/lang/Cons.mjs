// Copyright (c) Arne Brasseur 2023. All rights reserved.

import AbstractSeq from "./AbstractSeq.mjs"
import Empty from "./protocols/Empty.mjs"

export default class Cons extends AbstractSeq {
    constructor(x, xs) {
        super()
        this.x=x
        this.xs=xs
    }
    first() {
        return this.x
    }
    rest() {
        return Empty.satisfied(this.xs) && Empty._empty_$QMARK$_(this.xs) ?
            null : this.xs
    }
    seq() {
        return this
    }
}
