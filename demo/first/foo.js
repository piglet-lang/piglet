import piglet from "pigletlang/lang"
import piglet from "pigletlang/NodeCompiler"

piglet.inter("*compiler*", new NodeCompiler(...))

const bun_mod = await piglet.require(piglet.symbol("..."))
