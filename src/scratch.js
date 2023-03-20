

function str_hash_code(s) {
    for(var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
}

    hashCode() {
        return str_hash_code(this.namespace) + str_hash_code(this.name)
    }

// Set example code
var code = '(function(x) {})'
// Parse it into an AST
var ast = Parser.parse(code, { ecmaVersion: 6 })
// Format it into a code string
var formattedCode = astring.generate(ast)
// Check it
// console.log(ast)
// console.log(formattedCode)

// console.log(new StringReader("(js/+ 123 456)").read())
// console.log(new StringReader("(js/+ 123 456)").read().repr())
// console.log(new StringReader(".toString").read().repr())
// console.log(eval(astring.generate(new Analyzer().analyze(new StringReader("((fn* (a b) b) 1 2)").read()).estree())))
// console.log(new Analyzer().analyze(new StringReader("(.toString ((fn* (a b) b) 1 2))").read()).estree())
// console.log(astring.generate({type: "ExpressionStatement", expression:new Analyzer().analyze(new StringReader("(.toString ((fn* (a b) b) 1 20) 16)").read()).estree()}))
console.dir(new StringReader("(.toString ((fn* (a b) b) 1 20) 16)").read(), {depth: null})
console.log(eval(astring.generate(new Analyzer().analyze(new StringReader("(.toString ((fn* (a b) b) 1 20) 16)").read()).estree())))
//

code = 'foo.bar()'
code = '((function (a, b) {return b;})(1, 2)).toString()'

// console.dir(Parser.parse(code, { ecmaVersion: 6 }).body[0], {depth: null})

var done = (function wait () { if (!done) setTimeout(wait, 1000) })();
