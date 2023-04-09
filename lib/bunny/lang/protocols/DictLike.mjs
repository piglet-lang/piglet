
// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol, {extend_class} from "../Protocol2.mjs"

const DictLike = new Protocol(
    null,
    "bunny:lang",
    "DictLike",
    [["-keys", [[["this"], "Get a sequence of all keys in the dict"]]],
     ["-vals", [[["this"], "Get a sequence of all values in the dict"]]]]
)
export default DictLike

extend_class(
    Map,
    "bunny:lang:DictLike",
    [function _keys(m) {return m.keys()},
     function _vals(m) {return m.vals()}])
