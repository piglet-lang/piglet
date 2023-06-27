// Copyright (c) Arne Brasseur 2023. All rights reserved.

import Protocol from "../Protocol.mjs"

// Used for things that either "are" (QName, QSym), or "Have" (Var) a fully qualified name
const QualifiedName = new Protocol(
    null,
    "piglet:lang",
    "QualifiedName",
    [["-fqn", [[["this"], "Fully qualifed name, should return an absolute URI as a string, or nil."]]]]
)

export default QualifiedName
