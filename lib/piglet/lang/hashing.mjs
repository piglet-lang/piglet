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

import {hash_bytes, hash_str, hash_combine, hash_num} from "./xxhash32.mjs"

Hashable.extend(
    null, [(function _hash_code(_) { return 0 })],
    Number, [(function _hash_code(self) { return hash_num(self) })],
    String, [(function _hash_code(self) { return hash_str(self) })],
    Boolean, [(function _hash_code(self) { return self ? 1231 : 1237 })],
    Date, [(function _hash_code(self) { return self.valueOf() })],
    Sym, [(function _hash_code(self) {
        return hash_combine(
            self.pkg ? hash_str(self.pkg) : 0,
            hash_combine(self.mod ? hash_str(self.mod) : 0,
                         hash_str(self.name)))
    })],
    AbstractSeq, [(function _hash_code(self) { return Array.from(self, (e)=>Hashable._hash_code(e)).reduce(hash_combine, 0) })],
    Array, [(function _hash_code(self) { return self.map((e)=>Hashable._hash_code(e)).reduce(hash_combine, 0) })],
    Dict, [(function _hash_code(self) { return Array.from(self, ([k,v])=>hash_combine(Hashable._hash_code(k),
                                                                                      Hashable._hash_code(v))).reduce(hash_combine, 0) })],
    Keyword, [(function _hash_code(self) { return hash_str(self.inspect())})]
)

export const HASH_CACHE_SYM = Symbol("piglet:lang:cached-hash-value")

export function hash_code(o) {
    if (o == null) return 0
    return (o[HASH_CACHE_SYM] ||= Hashable._hash_code(o))
}
