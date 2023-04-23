// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Named = new Protocol(
    null,
    "piglet:lang",
    "Named",
    [["-name", [[["this"], "Get a string representation, used for various types of identifier objects when they need to be used in a contexts where only strings are allowed"]]]]
)
export default Named
