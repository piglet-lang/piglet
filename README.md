# Piglet

_A LISP for the JavaScript Age._

Piglet is a ES6-native LISP. In true LISP tradition it is in the first place
envisaged as a live environment, meaning the Reader, Compiler, and any other
language-level utilities are available at runtime.

```lisp
$ npm install -g piglet-lang
$ pig repl
piglet:lang=> (eval (read-string "(+ 1 1)"))
2
piglet:lang=> *current-module*
https://piglet-lang.org/packages/piglet:lang
piglet:lang=> (set! *qname-print-style* :full) 
:full
piglet:lang=> (print-str :foaf:name)
":http://xmlns.com/foaf/0.1/name"
```

Piglet is strongly influenced by Clojure, but it does not try to be a Clojure
implementation. It's a different language, allowing us to experiment with some
novel ideas, and to improve on certain ergonomics.

Features

- Supports any ES6 compatible runtime, including browsers and Node.js 
- RDF-style fully qualified identifiers both for code and data
- Interactive programming facilities
- Excellent and extensive JS interop, in both directions
- First class vars
- Value-based equality
- Uses wasm for fast hashing
- Metadata on data, functions, vars
- Introspection, meta-programming facilities, macros
- Extensible through protocols
- `Seq` abstraction for sequential data structure access, including lazy/infinite sequences
- Dict and Set datatypes, on top of JS's built-in data types (currently these
  are naive copy-on-write implementations, the Set implementation does have a
  fast hash-based membership test)
- Sequential and associative destructuring in `def`, `let`, `fn`, and `loop`
- Tail call optimization through `loop`/`recur`
- Extensible reader through tagged literals / data readers
- Built-in libs for dom manipulation, reactive primitives, command line argument handling, CBOR
- AOT compilation that is amenable to tree shaking (experimental/WIP)
- [ES6-class syntax](doc/class_syntax.md) with support for computed properties, static properties/methods/initializers 

## Getting started

See [Quickstart](doc/quickstart.md)

## Architecture

Piglet is not just a transpiler, but a full compiler and runtime implemented
directly in the host language (JavaScript). In that sense it is closer to
Clojure than to ClojureScript. Piglet provides full introspection over
packages/modules/vars.

Compilation happens by first reading strings to forms (S-expressions). The
Analyzer converts these to a Piglet AST. This is then converted to a
[ESTree](https://github.com/estree/estree)-compliant JavaScript AST, which is
then converted to JavaScript. This last step is currently handled by
[astring](https://github.com/davidbonnet/astring).

Piglet heavily leans into [protocols](doc/built_in_protocols.md). Many core
functions are backed by protocol methods, and these protocols are extended to
many built-in JavaScript types, providing very smooth interop.

## Docs

There is some more scattered information under [doc](doc/). It's a bit of a
hodgepodge mess at the moment.

## What's not there yet

A lot. Piglet is at the point where there's enough there to be at least
interesting, and perhaps even useful, but it is an ambitious project that is
currently not explicitly funded. Here are some of the things we hope to
eventually still get to.

- A pragma system to influence aspects of compilation on the package and module level
- Pluggable data structure literals, e.g. pragmas to compile dict literals to plain JS object literals
- Pragmas to compile destructuring forms to JS destructuring
- Full functional data structures, especially Dict
- There's currently no Vector implementation, we just use JS arrays (and that might be fine)
- Integration with ES build tools for one-stop-shop optimized compilation
- Hot code reloading (while an interactive programming workflow is generally superior, hot code reloading is very useful when doing UI work)
- The Tree-sitter grammar has some rough edges
- Support for editors beyond emacs (especially the ones that support tree-sitter)

## License

We have not yet determined the right license to release Piglet under, so while
the source is freely available, Piglet is not currently Free Software or Open
Source software.

If your company or organization is interested in funding Piglet development, get
in touch!

If you have interest in using Piglet for a commercial project please reach out
to [Gaiwan](https://gaiwan.co).

Copyright (c) Arne Brasseur 2023-2025. All rights reserved.
