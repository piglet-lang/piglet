// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Seqable = new Protocol(
    null,
    "piglet:lang",
    "Seqable",
    [["-seq", [[["this"], "Return a seq over the collection"]]]]
)

export default Seqable
