// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol2.mjs"

const Associative = new Protocol(
    null,
    "piglet:lang",
    "Associative",
    [["-assoc", [[["this", "k", "v"], "Associate the given value with the given key"]]],
     ["-dissoc", [[["this", "k"], "Remove the association between the thegiven key and value"]]]])

export default Associative
