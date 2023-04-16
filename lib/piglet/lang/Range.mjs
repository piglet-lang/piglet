// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {set_meta} from "./metadata.mjs"

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
    }

    first() {
        return this.from
    }

    rest() {
        if ((this.from + this.step) < this.to) {
            return new Range(this.from+this.step, this.to, this.step)
        }
        return null
    }
}
