# JavaScript integration

Piglet tries its best to make modern JavaScript features conveniently available.

## Literals

The `#js` reader dispatch causes the compiler to emit JavaScript literals,
either Arrays or Objects.

```lisp
#js [1 2 3]
#js {:foo 1 :bar 2}
```

Note that `#js` is not recursive, if you need nested JS arrays/objects, you need
to prefix each of them. Otherwise you'll end up with Piglet datasctructures
(Vector, Dict) inside your JS Arrays/Objects.

```lisp
#js [#js {:sound "Oink"}]
```

## Calling functions and looking up properties

The `js:` prefix is considered special, symbols with this prefix are converted
directly to JavaScript names.

```lisp
(js:String "hello")
```

You can chain property lookups directly onto this:

```lisp
(js:console.log "hello")
(js:window.document.createElement "div") 
```

A symbol starting with a period is converted to a method call:

```lisp
(.appendChild el child) 
```

A symbol starting with `.-` does a property lookup, rather than a function
invocation.

```lisp
(.-oink #js {:oink "OINK"})
(.-length "xxx")
```

Note that this is a low-level way of accessing properties, which will always do
a simple JS object property lookup. Generally you can look up properties in JS
objects the same way you do in Piglet dictionaries.

```lisp
(:oink #js {:oink "OINK"})
(get {:oink "OINK"} :oink)
```

## Manipulating data

Generally working with JS collections (arrays and objects, Set and Map
instances), you can simply use the same functions you use with Piglet
collections like dictionaries and lists.

- `conj`
- `assoc`
- `dissoc`
- `into`
- `get`
- `get-in`
- `assoc-in`
- `update`
- `update-in`

But note that these are all pure functions, they don't change the collection you
pass them, but instead create a new one. In other words: they need to copy over
the entire collection each time you call them. This means that update and insert
operations will get slower the more elements there are in the collection. This
isn't so much a concern with Piglet's data structures since those are designed
so we don't need to copy the entire collection (or at least they will be once we
get around to it).

We also have versions of these functions that do change the collection
"in-place".

- `conj!`
- `assoc!`
- `dissoc!`
- `into!`
- `assoc-in!`
- `update!`
- `update-in!`

```lisp
(let [x #js {}]
  (assoc-in! x [:x :y] 1)
  (update-in! x [:x :y] inc)
  x)
=> #js {:x #js {:y 2}}
```

## Protocol support

JavaScript built-ins like Arrays, Objects, but also Map instances, ArrayBuffer,
Uint8/32/64Array, etc. all implement one or more Piglet protocols, which means
they can be used directly with many of Piglet's core functions.

At a minimum these all implement Seqable, which means you can generally treat
them as a sequential collection. So you can call functions like `first` or `map`
on them, and they can take part in destructuring.

Arrays can be destructured.

```lisp
(let [[x y] #js [1 2]] (+ x y))
(map (fn [[k v]] (str k "--" v)) #js {:foo 1})
=> ("foo--1")
```

Objects can also be destructured.

```lisp
(let [{foo :foo} #js {:foo 123}] 
  foo)
```

This compiles to a `piglet:get` lookup, which checks if the object implements
the `Lookup` protocol (e.g. it's a `Dict`, `js:Map`, `js:Set`, `Module`). If
not, then it does a plain object key lookup. The same is true for `:keys`,
`:strs`, or `:syms`, which will all compile to a call to `(piglet:get object
string-or-keyword-or-symbol)`.

To compile to direct property access, regardless of the type of object or the
protocols it implements, use `:props`

```piglet
(let [{:keys [foo]
       :props [bar]} #js {:foo 123 :bar 456}] 
  [foo bar])
```

```js
  const dict_as42 = {
    "foo": 123,
    "bar": 456
  };
  const foo7 = $piglet$["https://piglet-lang.org/packages/piglet"].lang.get(dict_as42, $piglet$["https://piglet-lang.org/packages/piglet"].lang.keyword("foo"), null);
  const bar4 = dict_as42.bar;
```

Conversely, all Piglet datastructures implement Symbol.iterator. So you can
generally use them in JavaScript functions that take some kind of iterable
collection.

```lisp
(js:Map. {"hello" "world"})

(js:Array.from (range 5))
;; #js [0, 1, 2, 3, 4]
```

See [Built-in Protocols](built_in_protocols.md) for more details on the various protocols.

## Working with promises

Functions can be marked as async, and there's an await special form

```lisp
(defn ^:async my-fn []
  (await (js:fetch "...")))
```

For loops also support `^:async`, the result is a promise to a seq.

```lisp
(for ^:async [url ["http://example.com"]]
  (js:fetch url))
```

## Loading JS modules

You can load JavaScript modules/packages by using strings in your module's
import form.

```lisp
(module my-first-module
  (:import
    [lp :from "leftpad"]
    [g  :from "glob"))
```

This does a dynamic `await import("leftpad")`. It then creates a Piglet Module
aliased to the given alias, and interns any exported values into that module. If
there's a `default` export. A var is also created with the alias name in the
current module. If the imported module has a default export, then that is used,
otherwise the var points at the Module itself.

In the example above, `leftpad` has a default export, while `glob` does not.

```lisp
(lp:default "xx" 3)   ; 'default' var in the 'lp' module
(lp "xx" 3)           ; 'lp' var in the current module, same thing

(g:globSync "*.pig")  ; exported function from "glob"

;; It's a first class piglet var in a synthetic `js-interop/glob` module, aliased to `g`
#'g:globSync ;;=> #'js-interop/glob:globSync

(keys g) ; Modules implement DictLike
;;=> #js [__raw__, Glob, Ignore, escape, glob, globIterate, globIterateSync, globStream, globStreamSync, globSync, hasMagic, iterate, iterateSync, stream, streamSync, sync, unescape]

g:__raw__ ; the raw JS object we got back from `await import(,,,)` (subject to change, may not be available when AOT compiling)
```

On Node.js we mostly mimic Node's own package resolution rules. That means that
if you `npm install foo` and then `(:import [foo :from "foo"])` it generally
just works.

As in Node itself to import built-in packages, use the `node:` prefix. E.g.
`[process :from "node:process"]`.

In the browser you can add an import-map to tell the browser how to resolve
these files.

```html
<script type="importmap">
  {"imports":
   {"astring": "https://cdn.jsdelivr.net/npm/astring@latest/dist/astring.mjs",
    "solid-js": "https://cdn.jsdelivr.net/npm/solid-js@latest/dist/solid.js"}}
</script>
```

