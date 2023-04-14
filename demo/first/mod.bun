(module first/mod
  (:import [s :from ::second/mod2])

  )


(println (s:inc 8999))

(defn hello [x]
  (js:console.log (+ "Hello, " x)))

(hello "piglet!")

(defmacro foo (x)
  x)

;; (js:console.log (piglet.lang/resolve (piglet.lang/symbol "piglet.lang", "=")))
;; (js:console.log piglet.lang/Eq)

(js:console.log (first (cons 1 (cons 2 nil))))
(js:console.log (seq? (cons 1 (cons 2 nil))))
(js:console.log (iterable? (cons 1 (cons 2 nil))))
(js:console.log (iterator? (cons 1 (cons 2 nil))))
(js:console.log (iterator (array 1 2 3)))
(js:console.log (first (array 1 2 3)))
(println (rest (array 1 2 3)))
(println (cons 5 (list 1 2 3)))
(js:console.log Seq)

(defmacro foo (a b)
  (list '+ a b))

(println (foo 4 5))

(defmacro when (cond form)
  (list 'if cond form))

(when true
  (println "this prints"))


(when false
  (println "this doesn't"))
