// Copyright (c) Arne Brasseur 2023. All rights reserved.

export default class AbstractIdentifier {
    constructor(sigil, id_str) {
        this._sigil = sigil
        this._id_str = id_str
    }
    identifier_str() {
        return this._id_str
    }
    toString() {
        return `${this._sigil}${this._id_str}`
    }
}
