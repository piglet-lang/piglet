// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Derefable = new Protocol(
    null,
    "piglet:lang",
    "Derefable",
    [["deref", [[["this"], "Derefence a reference type"]]]]
)

export default Derefable
