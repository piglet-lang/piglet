import NodeCompiler from "./NodeCompiler.mjs"

class AOTCompiler extends NodeCompiler {
    async eval(form) {
        if (this.verbosity >= 2) {
            println("--- form ------------")
            println(form)
        }
        const ast = this.analyzer.analyze(form)
        if (this.verbosity >= 3) {
            println("--- AST -------------")
            console.dir(ast, {depth: null})
        }
        let estree = ast.emit(this.code_gen)
        if (this.verbosity >= 4) {
            println("--- estree ----------")
            console.dir(estree, {depth: null})
        }
        if (this.writer) {
            this.writer.write(
                this.estree_to_js(
                    Array.isArray(estree) ?
                        {type: 'Program', body: estree} :
                    estree))
        }
        estree = this.code_gen.wrap_async_iife(ast, estree)
        if (this.verbosity >= 5) {
            println("--- WRAPPED estree ----------")
            console.dir(estree, { depth: null })
        }
        let js = this.estree_to_js(estree)
        if (this.verbosity >= 1) {
            println("--- js --------------")
            println(js)
        }
        return await eval(js)
    }

}
