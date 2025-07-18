// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Seq from "./protocols/Seq.mjs"
import Empty from "./protocols/Empty.mjs"

export default class SeqIterator {
  constructor(seq) {
    if (Empty.satisfied(seq) && Empty._empty_$QMARK$_(seq)) {
      this.seq = null
    } else {
      this.seq = seq
    }
  }
  next() {
    if (this.seq) {
      const value = Seq._first(this.seq)
      this.seq = Seq._rest(this.seq)
      return {value: value, done: false}
    }
    return {value: void(0), done: true}
  }
  [Symbol.iterator]() {
    return this
  }
}
