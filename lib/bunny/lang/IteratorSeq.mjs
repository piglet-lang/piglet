// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class IteratorSeq {
    constructor(iterator, value, done) {
        this.value = value
        this.done = done
        this.iterator = iterator
    }

    static of(iterator) {
        const {value, done} = iterator.next()
        return new this(iterator, value, done)
    }

    first() {
        return this.value
    }

    rest() {
        const {value, done} = this.iterator.next()
        if (done) {
            return null
        }
        return new this.constructor(this.iterator, value, done)
    }
}
