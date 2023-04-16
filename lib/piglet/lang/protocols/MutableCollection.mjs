// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol, {extend_class} from "../Protocol.mjs"

const MutableCollection = new Protocol(
    null,
    "piglet:lang",
    "MutableCollection",
    [["-conj!", [[["coll", "el"], "Add element to collection, mutates the collection, returns the collection."]]]]
)
export default MutableCollection
