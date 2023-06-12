# 2. A Modern Functional LISP for the Web Age

Date: 2023-06-12

## Status

Accepted

## Context

We need to outline the vision and high level goals of the Piglet project.

## Decision

These are the ideas that we base the design of Piglet on:

Piglet is a LISP, a dynamically typed programming language with late binding,
support for interactive programming ("REPL"), compile-time programming through
macros, with reflection and introspection facilities. All aspects of the
language are available at runtime, including the compiler, reader (parser), and
the module system.

Piglet is a Modern LISP, with rich reader literals, a full-features standard
library powered by extensible protocols, threading macros, and destructuring.

Piglet is a functional language, with a data model focused on immutability,
including vectors, dicts, sets, lists, symbols, keywords, and fully-qualified
identifiers.

Piglet is designed for the web age. It is implemented as EcmaScript modules, and
can run in any compliant EcmaScript runtime, including web browsers, Node.js,
and elsewhere. It can interoperate bidirectionally with JavaScript code, and
includes facilities for making interoperability convenient.

Piglet embraces web standards, including EcmaScript, the W3C DOM, URI, and RDF.

## Consequences

These decisions make Piglet an appealing language for a wide range of use cases,
and make it a technology that can be applied in a wide range of contexts.
