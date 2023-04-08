// Copyright (c) Arne Brasseur 2023. All rights reserved.

export const META_SYM = new Symbol("meta")

export function meta(o) {
    return o[META_SYM]
}
