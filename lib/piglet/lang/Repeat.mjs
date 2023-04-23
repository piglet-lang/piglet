// Copyright (c) Arne Brasseur 2023. All rights reserved.

import AbstractSeq from "./AbstractSeq.mjs"

export default class Repeat extends AbstractSeq {
    constructor(count, value) {
        super()
        this.count = count
        this.value = value
    }

    first() {
        if (this.count === null || this.count > 0) {
            return this.value
        }
        return null
    }

    rest() {
        if (this._rest === undefined) {
            if (this.count === null) {
                this._rest = this
            } else if (this.count <= 1) {
                this._rest = null
            } else {
                this._rest = new this.constructor(this.count-1, this.value)
            }
        }
        return this._rest
    }

    seq() {
        return this.count <= 0 ? null : this
    }
}
