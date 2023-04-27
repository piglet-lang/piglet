// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {set_meta} from "./metadata.mjs"
import AbstractSeq from "./AbstractSeq.mjs"
import SeqIterator from "./SeqIterator.mjs"

export default class Range extends AbstractSeq {
    constructor(from, to, step, meta) {
        super()
        this.from = to ? from : 0
        this.to = to ? to : from
        this.step = step || 1
        set_meta(this, meta)
    }

    [Symbol.iterator]() {
        if (!this.to) {
            throw new Error("Can't get range iterator for infinte range")
        }
        return new SeqIterator(this)
    }

    first() {
        if (this.from < this.to) {
            return this.from
        }
        return null
    }

    rest() {
        if ((this.from + this.step) < this.to) {
            return new Range(this.from+this.step, this.to, this.step)
        }
        return null
    }

    seq() {
        return this.empty_p() ? null : this
    }

    count() {
        if (!this.to) {
            throw new Error("Can't count infinte range")
        }
        return Math.min(0, Math.floor((this.to - this.from) / this.step))
    }

    empty_p() {
        return this.from >= this.to
    }
}
