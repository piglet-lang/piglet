// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

const Repr = new Protocol(
    null, "piglet:lang", "Repr",
    [["-repr", [[["this"], "Return a string representation of the object"]]]])

export default Repr
