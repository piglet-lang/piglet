// Copyright (c) Arne Brasseur 2023. All rights reserved.

export function partition_n(n, args) {
    const partitions = []
    for (let i = 0 ; i<args.length; i+=n) {
        partitions.push(args.slice(i, i+n))
    }
    return partitions
}
