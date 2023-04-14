// Copyright (c) Arne Brasseur 2023. All rights reserved.

export const META_SYM = Symbol("piglet:lang:meta")

export function meta(o) {
    return o && o[META_SYM]
}

export function has_meta(o) {
    return META_SYM in o
}

export function set_meta(o, v) {
    Object.defineProperty(o, META_SYM, {value: v, writable: false})
}

export function set_meta_mutable(o, v) {
    Object.defineProperty(o, META_SYM, {value: v, writable: true})
}

export function reset_meta(o, v) {
    o[META_SYM] = v
}
