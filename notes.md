Vision

- Compile LISP to JavaScript AST (estree)
- Leave emitting of JS, minimizing, etc. to other tools (astring, escodegen, esmangle)
- Core is pure ES6, run in Node or browser (or elsewhere) directly from source
- Introduce a URI type that quacks like a keyword (can do map lookup etc)
- :foo:bar syntax resolves to full URI based on project/module config of prefixes (a la JSON-LD)
- contains? -> contains-key?
- persistent data types, but pluggable (protocol driven)
- nrepl-ish facilities built-in, but based on websockets/funnel


Three strategies?

- ESM
- globals
- dynamic imports?

FQID (fully qualified ids)

- :foo -> regular keyword, not an FQID
- :foo/bar/baz -> slash is not a special character, can have as many as you want

- :https://foo.bar/baz
- :foo.bar:baz
- ::baz

-> FQID starts with a `:` and contains one (1!) other `:`
-> if it contains `://` then it is fully qualified, no expansion needed
-> Otherwise the part before `:` is looked up in the *context*

- :"foo:bar is great!!!"
-> additional double quotes are allowed, and allow a wider range of characters


(module foo/bar
  (:context {"foo.bar" "https://foo.bar?"}))
  
:foo.bar:baz -> :"https://foo.bar?baz"
-> first part is looked up in context and used for expansion
             
(module foo/bar
  (:context {"foo.bar" "https://foo.bar/"
             "baz" "foo.bar:baz" ;;-> can itself contain a `:` which is expanded based on the context}
             
::baz -> :https://foo.bar/baz
-> with this syntax you look up `baz` by itself in the context, this becomes the expanded value

::moo -> :bunnny-lang://project-name/foo/bar/moo
-> if "moo" is not present in the context, then this becomes an FQID based on the project and module name
-> exact URL format is very much TBD
-> this implies there is a notion of a "current" URL that is used as the basis for expansion (kind of like relative links in HTML)


-> so can we also use relative references (not sure yet about this last bit)

(module foo/bar
  (:context {"moo" "../moo"}))
  
::moo -> :piglet-lang://package-name/foo/moo

Use within a given module is always static, using the context from the module
(and possibly parent modules, and the top-level package), so if a function
contains a relative reference like ::moo, then this will be locked in at compile
time.

But there are also facilities for dynamically accessing the context, in
particular for printing. So a context would be kept based on the currently
evaluating module, and printing an identifier would compact it based on that
context.

----------------------------------------------------------------------------


(module foo/bar/baz
  (:import ...)
  (:context {...})
  
JS imports:

[left-pad :from :npm:left-pad]
-> import left_pad from "left-pad"

[foo :from :node:process]
-> import foo from "node:process"

[foo :from :js:./foo/bar.js]
-> import foo from "./foo/bar.js"

Or maybe just use strings and pass through?

[foo :from "./foo/bar.js"]
[foo :from "node:fs"]

bun imports:
[n :from :lambdaisland/uri:normalize]
import n from "../../../lambdaisland~uri/normalize.mjs"

(n:normalize ...)


[foo :from ::my/local/file]
import normalize from "../../../user/my/local/file.mjs"

::foo
:localpackage:foo
"./foo"

[b :from :piglet:lang]

(b:str)
(piglet:lang:str)

Symbols:
package:module:var

Imports
::module (= :localpkg:module)
:package:module
:special-prefix:module
