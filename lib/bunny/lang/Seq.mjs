// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {define_protocol} from "./Protocol.mjs"
import Seqable from "./Seqable.mjs"

const Seq = define_protocol(
    self, "Seq",
    [["-first", [[["this"], "Return the first element of the seq"]]],
     ["-rest", [[["this"], "Return a seq of the remaining elements of this seq"]]]])

export default Seq

export function seq(o) {
    if (null === o) {
        return null
    }
    if (Seq.satisfied(o)) {
        return o
    }
    if (seqable_pred(o)) {
        return self.resolve("-seq").invoke(o)
    }
    if (iterator_pred(o)) {
        return IteratorSeq.of(o)
    }
    if (iterable_pred(o)) {
        return IteratorSeq.of(iterator(o))
    }
    throw new Error("" + o + " is not seqable")

}
