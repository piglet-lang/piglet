Vision

- Compile LISP to JavaScript AST (estree)
- Leave emitting of JS, minimizing, etc. to other tools (astring, escodegen, esmangle)
- Core is pure ES6, run in Node or browser (or elsewhere) directly from source
- Introduce a URI type that quacks like a keyword (can do map lookup etc)
- ::foo/bar syntax resolves to full URI based on project/module config of prefixes (a la JSON-LD)
- contains? -> contains-key?
- persistent data types, but pluggable (protocol driven)
- nrepl-ish facilities built-in, but based on websockets/funnel
