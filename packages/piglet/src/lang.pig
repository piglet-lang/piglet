(module lang)

(def into (fn* [o coll] (reduce conj o coll)))

(defmacro fn [argv & body]
  (let [syms (map (fn* [_] (gensym "arg")) argv)]
    (cons 'fn* (cons syms
                     (list
                      (apply list 'let (reduce into [] (map (fn* [bind arg] [bind arg]) argv syms))
                             body))))))

(defmacro defn [name argv & body]
  (list 'def name (apply list 'fn argv body)))

(defmacro lazy-seq [& body]
  (list 'make-lazy-seq (cons 'fn* (cons '[] body))))

(defn inc [x] (+ x 1))
(defn dec [x] (- x 1))
(defn identity [x] x)
