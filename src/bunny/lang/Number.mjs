// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class Number {
    constructor(raw, value) {
        this.raw = raw
        this.value = value
    }

    repr() {
        return this.raw
    }

    eq(other) {
        return (other instanceof Number) && this.value === other.value
    }

    emit(cg) {
        return cg.literal(this, this.value, this.raw)
    }
}
