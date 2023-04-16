// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const DictLike = new Protocol(
    null,
    "piglet:lang",
    "DictLike",
    [["-keys", [[["this"], "Get a sequence of all keys in the dict"]]],
     ["-vals", [[["this"], "Get a sequence of all values in the dict"]]]]
)
export default DictLike
