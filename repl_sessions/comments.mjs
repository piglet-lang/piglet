// Make sure acorn, astravel and astring modules are imported

import * as acorn from "acorn"
import * as astring from "astring"
import * as astravel from "astravel"

// Set example code
var code =
    [
        "const foo = /* @__PURE__ */((e)=>e)"
    ].join('\n') + '\n'
// Parse it into an AST and retrieve the list of comments
var comments = []
var ast = acorn.parse(code, {
    ecmaVersion: 6,
    locations: true,
    onComment: comments,
})
// Attach comments to AST nodes
astravel.attachComments(ast, comments)

console.dir(ast, {depth: null})

// Format it into a code string
var formattedCode = astring.generate(ast, {
    comments: true,
})
// Check it
// console.log(code === formattedCode ? 'It works!' : 'Something went wrong…')
