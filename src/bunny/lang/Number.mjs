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

    estree() {
        return {"type": "Literal",
                "start": this.start,
                "end": this.end,
                "value": this.value,
                "raw": this.raw}
    }
}
