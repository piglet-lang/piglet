// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {invoke_proto} from "./Protocol.mjs"

export default class SeqIterator {
    constructor(seq) {
        this.seq = seq
    }
    next() {
        if (this.seq) {
            const value = invoke_proto("bunny.lang/Seq", "-first", this.seq)
            this.seq = invoke_proto("bunny.lang/Seq", "-rest", this.seq)
            return {value: value, done: false}
        }
        return {value: void(0), done: true}
    }
    *[Symbol.iterator]() {
        return this
    }
}
