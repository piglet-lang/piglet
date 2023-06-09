// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Seq from "./protocols/Seq.mjs"
import Seqable from "./protocols/Seqable.mjs"
import Empty from "./protocols/Empty.mjs"
import AbstractSeq from "./AbstractSeq.mjs"
import {assert} from "./util.mjs"

export default class LazySeq extends AbstractSeq {
    constructor(thunk) {
        super()
        this.thunk = thunk
        this._seq = null
        this.realized = false
    }

    realize() {
        if (!this.realized) {
            this._seq = this.thunk()
            if (Empty.satisfied(this._seq) && Empty._empty_$QMARK$_(this._seq)) {
                this._seq == null
            }
            this.realized = true
        }
    }

    first() {
        this.realize()
        return Seq._first(this._seq)
    }

    rest() {
        this.realize()
        return Seq._rest(this._seq)
    }

    seq() {
        this.realize()
        return Seqable._seq(this._seq)
    }
}
