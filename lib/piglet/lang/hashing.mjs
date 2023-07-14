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
export {hash_bytes, hash_str, hash_combine, hash_num}

export const HASH_CACHE_SYM = Symbol("piglet:lang:cached-hash-code")

export function hash_code(o) {
    if (o == null) return 0
    const t = typeof o
    if ("object" === t || "function" === t) {
        return (o[HASH_CACHE_SYM] ||= Hashable._hash_code(o))
    }
    return Hashable._hash_code(o)
}
