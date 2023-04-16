// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {define_protocol} from "./Protocol.mjs"

const Seq = define_protocol(
    self, "Seq",
    [["-first", [[["this"], "Return the first element of the seq"]]],
     ["-rest", [[["this"], "Return a seq of the remaining elements of this seq"]]]])

export default Seq
