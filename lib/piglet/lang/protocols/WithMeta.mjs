// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const WithMeta = new Protocol(
    null,
    "piglet:lang",
    "WithMeta",
    [["-with-meta", [[["this", "meta"], "Return a version of the value with the new metadata associated with it."]]]]
)

export default WithMeta
