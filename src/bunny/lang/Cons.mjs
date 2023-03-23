// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol, {define_protocol, extend_protocol, munge_method_name} from "./Protocol.mjs"
import {Eq, HasMeta, Conjable, Seqable, Seq} from "./protocols.mjs"

class Cons {
    constructor(x, xs) {
        this.x=x
        this.xs=xs
    }
}

extend_protocol(
    Conjable,
    Cons,
    [["-conj", 2,
      function(self, o) {
          return new Cons(o, self)}]])
