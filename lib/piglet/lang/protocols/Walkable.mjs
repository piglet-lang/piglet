// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Walkable = new Protocol(
    null,
    "piglet:lang",
    "Walkable",
    [["-walk", [[["this", "f"],
                 "Apply the given function to each element in the collection, returning a collection of the same type and size"]]]]
)

export default Walkable
