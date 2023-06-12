# 2. Compile Lisp to EStree

Date: 2022-03-20

## Status

Accepted

## Context

In the last decade there has been renewed interest in the programming model of
Lisp, in large part due to the arrival of modern implementations that tap into
the power of a host language and platform, and that provide high quality
functional data structures, and quality of life syntactical additions.

We want to continue on this tradition, while providing greater accessibility,
and allowing for experimentation with new language features.

## Decision

The goal of the project is to create a compiler for a Lisp dialect, using pure
EcmaScript (ES6), which emits a standardized EcmaScript/JavaScript AST (EStree).

The compiler and language core will have no external dependencies, and require
no compilation.

## Consequences

The compiler and language runtime can be used directly, from source, in any
compliant JavaScript runtime. We only emit an AST, an external package will be
needed to emit code. A number of EStree-based code generators are available
off the shelf.
