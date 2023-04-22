// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Counted = new Protocol(
    null,
    "piglet:lang",
    "Counted",
    [["-count", [[["this"], "The number of elements in the collection"]]]]
)

export default Counted
