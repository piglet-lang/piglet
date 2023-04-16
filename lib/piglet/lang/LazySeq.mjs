// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Seq from "./protocols/Seq.mjs"
import SeqIterator from "./SeqIterator.mjs"

export default class LazySeq {
    constructor(thunk) {
        this.thunk = thunk
        this.seq = null
        this.realized = false
    }

    realize() {
        if (!this.realized) {
            this.seq = this.thunk()
            this.realized = true
        }
    }

    first() {
        this.realize()
        return Seq._first(this.seq)
    }

    rest() {
        this.realize()
        return Seq._rest(this.seq)
    }

    [Symbol.iterator]() {
        return new SeqIterator(this)
    }
}
