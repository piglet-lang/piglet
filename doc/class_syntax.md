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

(class foo  (^:static my_method [arg]))
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

```
