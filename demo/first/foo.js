import bunny from "bunnylang/lang"
import bunny from "bunnylang/NodeCompiler"

bunny.inter("*compiler*", new NodeCompiler(...))

const bun_mod = await bunny.require(bunny.symbol("..."))
