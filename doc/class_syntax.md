# `class` / `defclass`

The `class` special form creates a JavaScript class expression. `defclass` is a
simple macro which assigns the class value to a Piglet var of the same name as
the class.

Syntax overview

```lisp
(defclass 
  ;; name for the Piglet var, and for the class itself. Optional when using `class` expression
  my-class 
  ;; inherit from other class, SuperClass can be any expression
  :extends SuperClass
  ;; fields with and without inital value, static and non-static
  :fields [a ^:static b ^:static (c 123) (d 456)] 

  ;; Static initializer
  :init
  (do ,,,)
  
  ;; Property getters and setters
  :get (vvv [] ,,,)
  :set (vvv [v] ,,,)
  
  ;; Constructor, `super` and `this` can be used in the body
  (constructor [args]
    (super ,,,)
    (set! (.-xxx this) ,,,)
    ,,,)
  
  ;; Plain method, instance and static, `this` is available in the function body
  (some-method-name [args])
  :static (some-static-method-name [args])
  
  ;; Protocol implementations
  MyProtocol
  (-foo [,,,] ,,,)
  )
```
  
    
