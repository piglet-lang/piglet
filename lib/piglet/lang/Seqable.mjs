// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {define_protocol} from "./lang/Protocol.mjs"

const Seqable = define_protocol(
    self, "Seqable",
    [["-seq", [[["this"], "Return a seq over the collection"]]]])

export default Seqable
