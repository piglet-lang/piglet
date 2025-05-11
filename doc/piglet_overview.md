# Piglet Language Overview

## Keywords and Symbols, QNames and QSyms

Piglet has plain unqualified symbols, which evaluate to local variables or var
lookups, like any other LISP. It also has plain keywords, which start with a
colon, and are simple interned identifiers that evaluate to themselves, like
unqualified keywords in Clojure. As in Clojure these behave like functions which
perform a keyword lookup (works both for Piglet data structures and plain JS
maps).

Clojure also has qualified or namespaced symbols and keywords. The former as a
way to identify a var within a namespace, the latter as a fully qualified
identifier, allowing keys in dictionary-like objects to be less prone to
collision, and able to carry precise semantics for the associated value. Both
symbols and keywords can be abbreviated based on namespace aliases for
terseness.

One of the ideas we wanted to explore with Piglet is: what if Clojure had went
all the way and used full URIs as identifiers, both for data, and for code (var
resolution)? The result are `QName`s as an alternative to qualified keywords,
and `QSym`s as an alternative to qualified symbols.

## QName

A `QName` is a interned absolute URI identifier intended for data
representation. Written in their full form as syntax literals they start with a
colon, and must contain `://`.

```lisp
:http://xmlns.com/foaf/0.1/name
```

Fully writing them out like this however is unwieldy. Instead a set of prefixes
can be configured, which will be understood by both the reader and the printer.
A number of common default prefixes are available, like `rdf`, `owl`, `foaf`, or
`svg`.

```lisp
piglet:lang=> (fqn :foaf:name)
"http://xmlns.com/foaf/0.1/name"
```

Both printing and reading are controlled by the `*current-context*` var, which
holds a Dict from prefix to URI. If you've worked with JSON-LD this idea of a
current context should be familiar.

The idea is that both RDF identifiers and namespaced XML element names can be
represented directly, and that truly globally unique identifiers become the
norm, while at the source level one gets to largely ignore this verboseness
thanks to alias prefixes.

```lisp
piglet:lang=> (set! *current-context* (assoc *current-context* "foo" "https://example.com/foo#"))
piglet:lang=> (fqn :foo:bar)
"https://example.com/foo#bar"
```

Note that the separator here is the colon, as in JSON-LD, not the slash. Slashes
hold no special meaning, and keywords (or symbols) can contain any number of
slashes.

## QSyms, Packages, Modules, Vars

Both on disk and in-memory Piglet code is organized in Packages, Modules, and
Vars. Packages are fully first class, rather than being merely a boot-time
concern that then all gets lumped together into a single search path. A package
has a name, which is a URI (if no name is specified it gets a `file://` name
based on its location on disk). A package maps to a set of source files.

Each source file within a package defines a piglet Module (and can be compiled
to a ES6 module). The module name follows the file name starting from the
module's configured source directory (`src` by default). So a module `foo/bar`
goes into `src/foo/bar.pig`.

A module defines var (with `def` or `defn`), which gets interned into the
Module, which in turn is part of the Package, which is stored in the
ModuleRegistry.

Vars have fully qualified names, which is the name of the package, module, and
var, combined with colons.

```
piglet:lang=> (fqn #'assoc)
https://piglet-lang.org/packages/piglet:lang:assoc
```

A package has a `package.pig` file at the package root.

```lisp
{:pkg:name https://my-project.org/packages/hello-world
 :pkg:paths ["."]
 :pkg:deps {foolib {:pkg:location "../foolib"}}}
```

(`pkg` is a prefix in the default context aliased to `https://vocab.piglet-lang.org/package/`)

The `:pkg:deps` is in itself a sort of alias declaration, in this case it's
stating that within this `hello-world` package, the package which is located at
`../foolib` is aliased to `foolib`. Now we can load a module from that package,
assigning it its own local prefix.

```lisp
(module foo/bar
  (:import [bar :from foolib:foo/bar]))
```

## Standard library

Some libraries that are bundled with Piglet include

- piglet:string
- piglet:dom
- piglet:cbor

## More docs
