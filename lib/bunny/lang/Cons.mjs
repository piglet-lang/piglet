// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol, {define_protocol, extend_protocol, munge_method_name} from "./Protocol.mjs"
import {Eq, HasMeta, Conjable, Seqable, Seq} from "../lang.mjs"

export default class Cons {
    constructor(x, xs) {
        this.x=x
        this.xs=xs
    }
    *[Symbol.iterator]() {
        let s = this.xs
        return {
            next() {
            }
        }
    }
}
