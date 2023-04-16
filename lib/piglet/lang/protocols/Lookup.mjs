// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Lookup = new Protocol(
    null, "piglet:lang", "Lookup",
    [["-get", [[["this", "k"], "Get the value associated with k, or null/undefined if absent."],
               [["this", "k", "default"], "Get the value associated with k, or default"]]]])

export default Lookup
