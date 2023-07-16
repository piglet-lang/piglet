// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const MutableAssociative = new Protocol(
    null,
    "piglet:lang",
    "MutableAssociative",
    [["-assoc!", [[["this", "k", "v"], "Associate the given value with the given key"]]],
     ["-dissoc!", [[["this", "k"], "Remove the association between the the given key and value"]]]])

export default MutableAssociative
