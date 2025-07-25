// Copyright (c) Arne Brasseur 2023-2025. All rights reserved.

export default class AbstractSeq {
  /**
   * Return the first value in the Seq, or `null` if empty
   */
  first() {
    throw new Error("Not implemented")
  }

  /**
   * Return a Seq of the remaining values beyond the first. Returns `null` if
   * there are no remaining elements.
   */
  rest() {
    throw new Error("Not implemented")
  }

  /**
   * Return `this`, or `null` if the Seq is empty. This allows us to
   * distinguish between `(nil)` and `()`
   */
  seq() {
    throw new Error("Not implemented")
  }

  empty() {
    return this.seq() === null
  }

  [Symbol.iterator]() {
    let it = this.seq()
    if (it === null) {
      return {next: ()=>{
        return {value: undefined, done: true}
      }}
    }
    return {next: ()=>{
      const v = it.first()
      it = it.next()
      if (!it) {
        return {value: undefined, done: true}
      }
      return {value: v}
    }}
  }
}
