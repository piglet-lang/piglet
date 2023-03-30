// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class StringLiteral {
    constructor(raw, value) {
        this.raw = raw
        this.value = value
    }

    emit(cg) {
        return cg.literal(this, this.value, this.raw)
    }
}
