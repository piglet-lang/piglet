// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Hashable = new Protocol(
    null,
    "piglet:lang",
    "Hashable",
    [["-hash-code", [[["this"], "Get a hash code for this object"]]]]
)
export default Hashable
