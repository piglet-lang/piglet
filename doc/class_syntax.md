# `class` / `defclass`

The `class` special form creates a JavaScript class expression. `defclass` is a
macro which assigns the class value to a Piglet var of the same name as the
class.

(Note that `class` is only used to create JS class expressions, not to find the
"class" of an object, for that use `type`.)

```lisp
(defmacro defclass
  "Define a JavaScript class"
  [class-name & body]
  `(def ~class-name (class ~class-name ~@body)))
```

Syntax overview

```lisp
(class  ; or defclass
 ;; name for the Piglet var, and for the class itself. Optional when using `class` expression
 my-class
 ;; inherit from other class, SuperClass can be any expression
 :extends SuperClass
 ;; fields with and without inital value, static and non-static
 :fields [a, (b 123), ^:static 123, ^:static (d 456)]

 ;; Not sure yet about this bit. It's a neat bit of overloading, but what if you
 ;; want to emit this kind of code from a macro? I guess you can do a double
 ;; unquote?
 :fields [~(str "-" i)] ; computed property name
 :fields [(~(str "-" i) "foo")] ; computed property name with default value

 ;; Maybe this works? mimic JS itself?
 :fields [[(str "-" i)]] ; computed property name
 :fields [([(str "-" i)] "foo")] ; computed property name with default value

 ;; Static initializer block
 :init
 (do ,,,) ; takes any expression, use `do` if you want to do multiple things

 ;; Property getters and setters
 :get (vvv [] ,,,)
 :set (vvv [v] ,,,)

 ;; Constructor, `super` and `this` can be used in the body
 (constructor [arg]
              (super ,,,)
              (set! (.-xxx this) ,,,)
              ,,,)

 ;; Plain method, instance and static, `this` is available in the function body
 (some-method-name [arg])
 (^:static some-static-method-name [arg])
 ([(str hello "-" world)] [arg] ,,,) ; computed method name

 ;; Protocol implementations
 MyProtocol
 (-foo [,,,] ,,,)
 )
```

Step by step:

```lisp
(class) ;=> class {}
(class foo) ;=> class foo {}
(class foo :extends Bar) ;=> class foo extends bar {}

(class foo (my_method [arg]))
;;=> class foo {
;;    my_method(arg6) {
;;    }
;; }

(class foo  (my-method [arg]))
;;=> class foo {
;;    ["my-method"](arg6) {
;;    }
;; }

(class foo (^:static my_method [arg]))
;;=> class foo {
;;    static my_method(arg6) {
;;    }
;; }

(class foo :extends Object (constructor [arg] (super arg)))
;; class foo extends Object {
;;     constructor(arg9) {
;;       return super(arg9);
;;     }
;; }

(class :fields [a]) ;;=> class {a;}
(class :fields [(a 1)]) ;;=> class {a = 1;}
(class :fields [^:static a]) ;;=> class { static a ; }
(class :fields [^:static (a 1)]) ;;=> class { static a = 1; }
(class :fields [(~(str "xxx") 1)]) ;;=> class { ["xxx"] = 1; }
(class :fields [(~(str "xxx") 1)]) ;;=> class { ["xxx"] = 1; }

(class X :set (foo [v] (set! this.bar v)))
;; class X {
;;     set foo(v20) {
;;       return this.bar = v20;
;;     }
;; }

(class X :get (foo [] this.bar))
;; class X {
;;     get foo() {
;;       return this.bar;
;;     }
;; }

(class X ([js:Symbol.iterator] [] ,,,)) ;;=> make a class iterable
```

## Computed properties

In JavaScript in both object literals and class expressions you can use an extra
pair of square brackets to indicate that a given property name is computed on
the fly.

```javascript
const foo = class {
  [`_${2*2}`] = 4;

  ["_xxx"]() {
    return 9
  }
}
```

We adopted the same syntax, wherever you would have a field or method name in a
`class` or `defclass`, you can introduce an extra pair of brackets to indicate
that the name should be computed. It's a little bit like an unquote (`~`),
you're opting in to evaluation of something that normally is static.

```lisp
(class foo :fields [a]) ;; base case, not computed
(class foo :fields [[(str "a")]]) ;; computed
(class foo :fields [(a 4)]) ;; with default value
(class foo :fields [([(str "a")] 4)]) ;; with default value, computed
(class foo
  (bar [])) ;; method definition
(class foo
  ([(str "bar")] [])) ;; computed method definition
```

## Static

JS has three ways the `static` keyword can be used in a class definition, all
indicating that something is defined on the class (prototype) level, and not on
the instance level

Static initializer blocks are a top-level syntactic construct, for these we use
the `:static` keyword, similar to how we have `:extends` or `:fields`. `:static`
needs to be followed by a single form. Use `do` if you want to execute multiple
statements.

```lisp
(class Foo
  :static
  (do
    (set! this.bar 123))) ;; class level attribute
```

For fields and methods, you use a `^:static` metadata tag on the field or method
name.

```lisp
(class Foo
  :fields [^:static bar]
  (^:static baz [] ,,,))
```

If the field has a default value, then `^:static` still goes on the name of the
property.

```lisp
(class Foo
  :fields [(^:static bar 123)])
```

Putting it outside the list form also works, but it's easiest to remember that
`^:static` always goes directly in front of the name.

In case of computed properties/methods, `:^static` goes before the wrapping
vector.

```lisp
(class Foo
  :fields [(^:static ["bar"] 123)])
```

## Protocols

Piglet protocols are based on `js:Symbol` instances, which we call sentinels.
There's a sentinel for each protocol method, and one for the protocol itself.
When a protocol's dispatch function is called, it looks for these sentinels to
find the right method implementation.

```lisp
(defclass foo 
  Counted
  (-count [this] 3))
```

This code is equivalent to (using computed properties)

```lisp
(defclass foo 
  :fields [([(.-sentinel Counted)] true)]
  ([(.method_sentinel Counted "-count" 1)] [this] 3))
  
(count. foo) ;;=> 3
```

Piglet knows that you're extending a protocol when it encounters a symbol inside
the `class` form. This leads to a potential ambiguity when defining an anonymous
class.

```lisp
(let [x (class Counted (-count [this] 5))]
  (count (x.)))
```

In this case Piglet will assume you are trying to create a class named
`Counted`, rather than extending the `Counted` protocol. Because of this, and
for consitency with the rest of the class syntax, you may prefix protocol
implementations with `:implements`

```lisp
(let [x (class :implements Counted (-count [this] 5))]
  (count (x.)))
```

## `make-type` / `deftype`

There are also two macros, `make-type` and `deftype`, which mimic the above
syntax, but do so by generating prototype-based code. Rather than emitting
`class ...` the result looks like this:

