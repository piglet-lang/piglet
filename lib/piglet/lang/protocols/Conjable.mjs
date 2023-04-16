// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol2.mjs"

const Conjable = new Protocol(
    null,
    "piglet:lang",
    "Conjable",
    [["-conj", [[["this", "e"], "Return a collection with the element added"]]]]
)
export default Conjable
