// Copyright (c) Arne Brasseur 2023. All rights reserved.

import SeqIterator from "./SeqIterator.mjs"

export default class Cons {
    constructor(x, xs) {
        this.x=x
        this.xs=xs
    }
    first() {
        return this.x
    }
    rest() {
        return this.xs
    }
    [Symbol.iterator]() {
        return new SeqIterator(this)
    }
}
