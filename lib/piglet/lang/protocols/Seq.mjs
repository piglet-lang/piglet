// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol2.mjs"

const Seq = new Protocol(
    null,
    "piglet:lang",
    "Seq",
    [["-first", [[["this"], "Return the first element of the seq"]]],
     ["-rest", [[["this"], "Return a seq of the remaining elements of this seq"]]]]
)

export default Seq
