// Copyright (c) Arne Brasseur 2023. All rights reserved.

import {assert} from "./util.mjs"

export const META_SYM = Symbol("piglet:lang:meta")

function assert_dict(o, v) {
  if (v === null) return
  if (v.constructor.name !== "Dict") {
    throw new Error(`Metadata must be a Dict, got ${v.constructor.name} ${v} ${JSON.stringify(v)} on ${o.inspect ? o.inspect() : o}`)
  }
}

export function meta(o) {
  const t = typeof o
  return (o && (t === 'object' || t === 'function') && o[META_SYM]) || null
}

export function has_meta(o) {
  return META_SYM in o
}

export function set_meta(o, v) {
  // if (meta(o)) {
  //     console.log("ALREADY HAS META", o)
  // }
  if (v != null) {
    assert_dict(o, v)
    Object.defineProperty(o, META_SYM, {value: v, writable: false})
  }
  return o
}

export function set_meta_mutable(o, v) {
  assert_dict(o, v)
  Object.defineProperty(o, META_SYM, {value: v, writable: true})
  return o
}

export function set_meta_computed(o, f) {
  Object.defineProperty(o, META_SYM, {get: ()=>{const v = f(); assert_dict(o, v); return v}})
  return o
}

export function reset_meta(o, v) {
  assert_dict(o, v)
  o[META_SYM] = v
  return o
}
