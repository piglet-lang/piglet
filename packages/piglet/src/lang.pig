(module lang)

(def into (fn* [o coll] (reduce conj o coll)))

(defmacro fn [argv & body]
  (let [syms (map (fn* [_] (gensym "arg")) argv)]
    (cons 'fn* (list syms
                     (apply list 'let (reduce into [] (map (fn* [bind arg] [bind arg]) argv syms))
                            body)))))

(defmacro defn [name argv & body]
  (list 'def name (apply list 'fn argv body)))

(defmacro lazy-seq [& body]
  (list 'make-lazy-seq (cons 'fn* (cons '[] body))))

(defn inc [x] (+ x 1))
(defn dec [x] (- x 1))
(defn identity [x] x)

(defmacro doseq [binds & body]
  (let [lrs (partition 2 binds)
        ls (map first lrs)
        rs (map second lrs)
        inner-fn (cons 'do body)]
    (reduce (fn [acc [var coll]]
              (list 'reduce (list 'fn* ['_ var] acc) nil coll))
            inner-fn (reverse (map list ls rs)))))

(defn macroexpand [form]
  (let [var (resolve (first form))]
    (apply (.bind (.-invoke var) var) (rest form))))
