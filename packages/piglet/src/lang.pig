(module lang)

(defmacro defn [name argv body]
  (list 'def name (list 'fn* argv body)))

(defn inc [x] (+ x 1))
(defn dec [x] (- x 1))
(defn identity [x] x)
