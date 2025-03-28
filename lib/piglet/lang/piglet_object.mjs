// Copyright (c) Arne Brasseur 2023. All rights reserved.

/**
 * Special marker property to signal that an object/value is part of the Piglet
 * world. Any builtins (collections, identifiers), as well as types created
 * within user code (except when using the most low level constructs), get
 * marked as a "piglet object".
 *
 * This acts as a allowlist/denylist of sorts, in that we never treat these
 * objects as raw JS objects. This in turn allows us to have more convenient JS
 * interop, since we don't risk accidentally exposing a Piglet value as a plain
 * JS value.
 */

export const PIGOBJ_SYM = Symbol("piglet:lang:piglet-object")

export function mark_as_piglet_object(o) {
    Object.defineProperty(o, PIGOBJ_SYM, {value: true, writable: false})
    return o
}

export function piglet_object_p(o) {
    const t = typeof o
    return ("undefined" !== t || "null" !== t) && o[PIGOBJ_SYM]
}
