// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Empty = new Protocol(
    null,
    "piglet:lang",
    "Empty",
    [["-empty?", [[["this"], "Is this an empty collection?"]]]]
)

export default Empty
