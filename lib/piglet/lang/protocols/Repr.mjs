// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol2.mjs"

const Repr = new Protocol(
    null, "piglet:lang", "Repr",
    [["-repr", [[["this"], "Return a string representation of the object"]]]])

export default Repr

Repr.extend(
    Number, [function _repr(self) {return self.toString()}],
    String, [function _repr(self) {return `"${self}"`}],
    null, [function _repr(self) {return "nil"}],
    Boolean, [function _repr(self) {return self.toString()}],
    Symbol, [function _repr(self) {return `#js:Symbol \"${self.description}\"`}],
    Array,  [function _repr(self) {return `#js [${self.map(e=>Repr._repr(e)).join(" ")}]`}],
)
