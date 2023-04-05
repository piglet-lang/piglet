// Copyright (c) Arne Brasseur 2023. All rights reserved.

export function partition_n(n, args) {
    const partitions = []
    for (let i = 0 ; i<args.length; i+=n) {
        partitions.push(args.slice(i, i+n))
    }
    return partitions
}

export function assert(bool, message) {
    if (!bool) {
        throw new Error("Assertion failed" + (message ? (", " + message) : ""))
    }
}

export function assert_type(val, type, message) {
    if (typeof type === 'string') {
        assert(typeof val === type, message || "Expected " + JSON.stringify(val) + " to be of type " + type)
    } else {
        assert(val.constructor == type, message || "Expected " + JSON.stringify(val) + " to be of type " + type)
    }
}
