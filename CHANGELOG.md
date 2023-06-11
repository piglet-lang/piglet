# Unreleased

## Added

## Fixed

## Changed

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
