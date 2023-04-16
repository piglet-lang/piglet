(module lang)

(defmacro defn [name argv body]
  (list 'def name (list 'fn* argv body)))

(defmacro lazy-seq [& body]
  (list 'make-lazy-seq (cons 'fn* (cons '[] body))))

(defn into [o coll]
  (reduce conj o coll))

(defn inc [x] (+ x 1))
(defn dec [x] (- x 1))
(defn identity [x] x)
