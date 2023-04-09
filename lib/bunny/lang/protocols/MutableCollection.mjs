// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol, {extend_class} from "../Protocol2.mjs"

const MutableCollection = new Protocol(
    null,
    "bunny:lang",
    "MutableCollection",
    [["-conj!", [[["coll", "el"], "Add element to collection, mutates the collection, returns the collection."]]]]
)
export default MutableCollection

extend_class(
    Array,
    "bunny:lang:MutableCollection",
    [function _conj_$BANG$_(arr, el) {
        arr.push(el)
        return arr
    }]
)

extend_class(
    Map,
    "bunny:lang:MutableCollection",
    [function _conj_$BANG$_(m, el) {
        const [k, v] = el
        return m.set(k, v)
    }]
)

extend_class(
    Object,
    "bunny:lang:MutableCollection",
    [function _conj_$BANG$_(o, el) {
        const [k, v] = el
        o[k] = v
        return o
    }]
)
