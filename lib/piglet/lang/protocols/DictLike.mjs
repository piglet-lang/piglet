
// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol, {extend_class} from "../Protocol2.mjs"
import IteratorSeq from "../IteratorSeq.mjs"

const DictLike = new Protocol(
    null,
    "piglet:lang",
    "DictLike",
    [["-keys", [[["this"], "Get a sequence of all keys in the dict"]]],
     ["-vals", [[["this"], "Get a sequence of all values in the dict"]]]]
)
export default DictLike

DictLike.extend(
    Map,
    [function _keys(m) {return IteratorSeq.of(m.keys())},
     function _vals(m) {return IteratorSeq.of(m.values())}])
