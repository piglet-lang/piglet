// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Hashable from './protocols/Hashable.mjs'

import Sym from "./Sym.mjs"
import Keyword, {keyword} from "./Keyword.mjs"
import QName from "./QName.mjs"
import PrefixName from "./PrefixName.mjs"
import Context from "./Context.mjs"
import AbstractIdentifier from "./AbstractIdentifier.mjs"

import AbstractSeq from "./AbstractSeq.mjs"
import Cons from "./Cons.mjs"
import Dict from "./Dict.mjs"
import IteratorSeq from "./IteratorSeq.mjs"
import List from "./List.mjs"
import Range from "./Range.mjs"
import SeqIterator from "./SeqIterator.mjs"
import LazySeq from "./LazySeq.mjs"
import Repeat from "./Repeat.mjs"

import {piglet_object_p} from "./piglet_object.mjs"
import {hash_bytes, hash_str, hash_combine, hash_num} from "./xxhash32.mjs"
export {hash_bytes, hash_str, hash_combine, hash_num}

const HASH_CACHE = new WeakMap()
// Symbols don't generally work in weakmaps yet, and they are frozen so we can't
// cache the hash on the symbol object... so we keep them all. Not ideal,
// potential memory leak.
const SYMBOL_HASH_CACHE = {}

export function hash_code(o) {
  if (o == null) return 0
  const t = typeof o
  if ("object" === t || "function" === t) {
    // This doesn't seem to be generally supported yet.
    // https://github.com/tc39/proposal-symbols-as-weakmap-keys
    // || ("symbol" === t && "undefined" === typeof Symbol.keyFor(o))) {

    if (HASH_CACHE.has(o)) {
      return HASH_CACHE.get(o)
    }
    const hsh = Hashable._hash_code(o)
    if (piglet_object_p(o) || Object.isFrozen(o))
      HASH_CACHE.set(o, hsh)
    return hsh
  }

  if ("symbol" === t) {
    if (o in SYMBOL_HASH_CACHE) {
      return SYMBOL_HASH_CACHE[o]
    }
    return SYMBOL_HASH_CACHE[o] = Hashable._hash_code(o)
  }

  return Hashable._hash_code(o)
}
