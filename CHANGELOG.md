# Unreleased

## Added

## Fixed

## Changed

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
