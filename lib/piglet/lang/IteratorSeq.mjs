// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class IteratorSeq {
    constructor(iterator, value, done) {
        this.value = value
        this.done = done
        this._rest = null
        this.iterator = iterator
    }

    static of(iterator) {
        const {value, done} = iterator.next()
        if (done) return null
        return new this(iterator, value, done)
    }

    static of_iterable(iterable) {
        return this.of(iterable[Symbol.iterator]())
    }

    first() {
        return this.value
    }

    rest() {
        if (this._rest) {
            return this.rest
        }
        const {value, done} = this.iterator.next()
        if (done) {
            return null
        }
        this._rest = new this.constructor(this.iterator, value, done)
        return this._rest
    }

    [Symbol.iterator]() {
        let head = this.done ? null : this
        return {next: ()=>{
            if(!head) {
                return {value: null, done: true}
            }
            const ret = {value: head.value,
                         done: head.done}
            head = head.rest()
            return ret
        }}
    }
}
