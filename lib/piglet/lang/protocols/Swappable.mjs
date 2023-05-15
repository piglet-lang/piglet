// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Swappable = new Protocol(
    null,
    "piglet:lang",
    "Swappable",
    [["-swap!", [[["this", "fn", "args"], "Swap the value contained in reference type by applying a function to it."]]]]
)

export default Swappable
