# Unreleased

## Added

- Associative destructuring (keys/syms/props/strs)
- Syntax for regex: `%r/pattern/modifiers` (choose your own delimiters)
- Free-spacing mode for regex with the `x` modifier: `%r"... whitespace-and-comments..."x`
- %q(...) (strings) / %w[...] (words)
- `binding` macro
- `(var ...)` / `#'` special form
- string API: conversions to/from dromedary case
- stirng API: starts-with? ends-with? includes?
- PDP Bookmarklet (see getting started docs)

## Fixed

- Fixed map over iterators
- re-find / re-seq: return the string match rather than an array if there are no capturing group
- Fix walk over sets

## Changed

- Hash codes are now cached in a weakmap, rather than on the object using a Symbol (because we can't set a property on frozen objects)
- Give frozen js objects value-based hashes, other objects get identity (incrementing) hashes
- `*verbosity*` is now a var rather than a compiler setting
- When using one or more `-v`/`--verbose` flag, only up the verbosity after the piglet core has loaded

# 0.0.25 (2023-07-18 / 9203b9)

## Added

- string module: upcase, downcase, subs, capitalize, join, split, {kebap,camel,snake}->{kebap,camel,snake}
- regex syntax: /foo/imgs

## Fixed

- dev-server: deal with arrays in exports
- dev-server: deal with missing package.json

## Changed

- move join/split to string module

# 0.0.24 (2023-07-17 / d83ceb)

## Added

- Provide more bang versions (`assoc!`, `dissoc!`, `update-in!`) that mutate
- Implement hashable for Function, RegExp, Boolean, BigInt, Array, Symbol, ...
- Support Ctrl-D in the REPL
- dev-server: handle wildcards in "exports" in node modules package.json
- dev-server: add doctype to index.html
- dev-server: create a stub package.pig if missing
- API: set?, assoc!, dissoc!, special-form?, update!, update-in!, assoc-in!

## Fixed

- Syntax-quote: improve handling of symbols
- JS interop docs update
- Fix regression: empty lets are allowed
- Change in policy: emitting undefined is allowed
- Fix multi-arg (> 2) binary operators
- Analyze forms inside set literals (allow computed values)
- Make sure `for` returns a sequence/list (not a vector/array)
- dev-server: don't die if node_modules is missing

## Changed

- Drop the `oset`/`oget`/`okeys`/`oassoc`/... functions
- Instead make regular `get`, `assoc` etc work with JS arrays/objects
- Mak `type` also lookup the constructor on functions (for Keyword etc)
- DOM API: rename query to query-one (vs query-all)
    
# 0.0.23 (2023-07-14 / 6bf6d0)

## Changed

- `bin/piglet` tweaks

# 0.0.21 (2023-07-14 / 9bda98)

## Changed

This is a pretty big release, some highlights:

- dev-server for much easier onramp when doing webdev
- source maps support (in the browser, if the source-map library is present)
- add syntax-quote (backtick)
- compile directly to JS operators (unary and binary, e.g. +, and, not) if possible, while falling back to the function version, e.g. when used in higher order functions
- added `reduced` for short-circuiting reductions
- significant performance improvements
- add sets (`#{}`)
- makes sets and dicts callable
- much improved sequential destructuring
- support unicode codepoints in string (`"\u{1234}"`), including higher-plain ones
- add --eval / -e flag to piglet script
- Nodejs 17 support (before we required at least 18)
- Add completion support to pdp-client.el (see also the counterpart of this in pdp.el)
- Make TypedArray (e.g. Uint8Buffer) and ArrayBuffer seqable, and make them print nicely
- toJSON support in collections, so you can call JSON.stringify on them
- DOM wrapper API
- Allow a bare symbol as an import
- Specifying a package id is optional (will use URI derived from package location)
- Interop improvements: keyword lookup for plain JS objects,
  ->pig/->js lazy nested conversions (still lots of thinking and improving to do around interop)
- Lots of additional core API: ->js ->pig apropos apropos boolean? constantly defmethod defmulti defonce doto drop empty? ffirst fnil fqn frequencies get-in hash-code hash-combine identifier? juxt keep max merge min not= object? oget okeys oset ovals rand-int rand-nth reference repeatedly reset! run! sort take type-name undefined? vector vector?

# 0.0.20 (2023-06-11 / 29fedf)

## Added

- `load-package` as shorthand for `(.load_package *compiler* ...)`
- More getting started docs on how to use in the browser

## Fixed

- [browser] only resolve relative JS imports, leave the others to be handled by the browser (i.e. by an `importmap`)

# 0.0.19 (2023-06-11 / 9f059e)

## Fixed

- [browser] resolve piglet:lang relative to the location that browser/main.mjs was loaded from
  - This enables loading Piglet from a CDN

# 0.0.17 (2023-06-11 / 8449a7)

## Added

- `bin/piglet` convenience wrapper
- "Getting Started" doc
- pdp-client
  - add the resolve-meta operation, useful for "jump-to-definition"
- Core API
  - split / join
  - spit
  - re-find / re-seq
  - -> / ->> / cond->
- piglet:dom namespace
  - convenience wrappers around W3C DOM
  - Piglet forms to HTMLElement rendering 
- QName: retain suffix/prefix info when expanding from PrefixName
  - useful for XML namespace handling
- Default context: add SVG xml namespace
- Async versions of `reduce` and `for`: `(for ^:async [...] ...)` -> can use `(await)` in the body, and returns a promise of a sequence
- Move piglet-mode/pdp.el to a separate `piglet-emacs` repo

## Fixed

- Import of js packages with an '@' in their name
- Allow destructuring in doseq/for
- Multi-arg boolean operators (e.g. `(< 1 2 3)`)
  - compile to `1 < 2 && 2 <3` instead of `1 < 2 < 3`
- Make imports of node_modules relative to the importing package

## Changed

- Make `*current-context*` a regular dict, rather than a `Context` wrapper

# 0.0.16 (2023-05-19)

Significantly improved module system. First version to use full URI/QSym
identifiers.

# 0.0.9 - 0.0.15 (2023-04-14 - 2023-04-23)

Initial alpha releases.
