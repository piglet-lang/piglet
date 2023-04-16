// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol2.mjs"

const Eq = new Protocol(
    null,
    "piglet:lang",
    "Eq",
    [["-eq", [[["this", "that"], "Check equality"]]]]
)
export default Eq
