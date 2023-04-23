// Copyright (c) Arne Brasseur 2023. All rights reserved.

import AbstractSeq from "./AbstractSeq.mjs"

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
        return this.xs
    }
    seq() {
        return this
    }
}
