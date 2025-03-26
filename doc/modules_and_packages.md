# Modules and Packages

Each Piglet (`.pig`) file defines a Piglet Module, which compiles to a
JavaScript module (`.mjs`).

Modules are organized in Packages, which is the unit of code distribution. At
the project root you should have a `package.pig` file which defines your
project's package, which directories contain source files, and which Piglet
dependencies your package has.

```lisp
{:pkg:id "https://your.org/piglet-packages/my-package"
 :pkg:path ["src"]
 :pkg:deps {some-alias {:pkg:location "../other-package-dir"}}}
```

Module files within a package are placed at `src/<module-name>.pig`, so
`my-first-module` is placed at `src/my-first-module.pig`, and the module
`util/data` is placed in `src/util/data.pig`. Notice that no munging happens on
the module name, the file names mimic the module names exactly, including
underscores and slashes.

The first form in the module file should be the module declaration.

```lisp
(module my-first-module
  (:import
    [data :from util/data]                  ; from current package, explicit alias
    helpers                                 ; from current package, name = alias
    [dom :from piglet:dom]                  ; from built-in piglet package
    [other-mod :from some-alias:other-mod]  ; from dependent package, some-alias defined in package.pig
    [lp :from "leftpad"]))                  ; JS import, gets turned into a module + vars
```

This demonstrates the options you have when importing.

- `[data :from util/data]` - since `util/data` is an unqualified symbol (no `:`)
  this is understood as referring to a module in the same package as this
  module. The vars in `util/data.pig` are available in this module with the
  `data:` prefix, e.g. `(data:remove-entity-items ,,,)`
- `helpers` - a bare identifier like this is equivalent to `[helpers :from
  helpers]`, this gives you an easy way to depend on modules in the same package
- `[dom :from piglet:dom]` - This loads the `dom` module inside the built-in
  `piglet` package. The `piglet` alias is always available.
- `[other-mod :from some-alias:other-mod]` - Load from a different package,
  `some-alias` is the package alias defined in `package.pig` of this package.
- `[lp :from "leftpad"]` - Strings get converted to JS import statements, and
  the exports therein are turned into piglet vars.
  
For more info on importing and using JS modules, see [JavaScript Interop](javascript_interop.md).
  
