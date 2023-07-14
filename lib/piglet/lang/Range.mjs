// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {set_meta} from "./metadata.mjs"
import AbstractSeq from "./AbstractSeq.mjs"
import SeqIterator from "./SeqIterator.mjs"

export default class Range extends AbstractSeq {
    constructor(from, to, step, meta) {
        super()
        this.from = from
        this.to = to
        this.step = step
        set_meta(this, meta)
    }

    static range0() {
        return new Range(0, undefined, 1)
    }

    static range1(to) {
        return new Range(0, to, 1)
    }

    static range2(from, to) {
        return new Range(from, to, 1)
    }

    static range3(from, to, step) {
        return new Range(from, to, step)
    }

    [Symbol.iterator]() {
        if (this.to === undefined) {
            throw new Error("Can't get range iterator for infinte range")
        }
        let i = this.from
        return {next: ()=>{
            const v = i
            if (v < this.to) {
                i+=this.step
                return {value: v}
            }
            return {done: true}
        }}
    }

    first() {
        if (this.to === undefined || (this.from < this.to)) {
            return this.from
        }
        return null
    }

    rest() {
        if (this.to === undefined || ((this.from + this.step) < this.to)) {
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
        return Math.max(0, Math.floor((this.to - this.from) / this.step))
    }

    empty_p() {
        return this.from >= this.to
    }

    inspect() {
        return `Range(${this.from}, ${this.to}, ${this.step})`
    }
}
