// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {set_meta} from "./metadata.mjs"
import SeqIterator from "./SeqIterator.mjs"

export default class Range {
    constructor(from, to, step, meta) {
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

    empty_p() {
        return this.from >= this.to
    }
}
