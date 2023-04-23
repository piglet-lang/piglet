(module :piglet:lang)

(def into (fn* [o coll] (reduce conj o coll)))

(defmacro fn [?name argv & body]
  (let [[?name argv body] (if (symbol? ?name)
                            [?name argv body]
                            [nil ?name (cons argv body)])
        argv-clean (remove (fn* [a] (= a (symbol "&"))) argv)
        syms (map (fn* [a]
                       (if (= a (symbol "&"))
                         a
                         (gensym "arg"))) argv)
        syms-clean (remove (fn* [a] (= a (symbol "&"))) syms)
        fntail (list syms
                     (apply list 'let (reduce into [] (map (fn* [bind arg] [bind arg]) argv-clean syms-clean))
                            body))
        fntail (if ?name (cons ?name fntail) fntail)
        ]
    (cons 'fn* fntail)))

(defmacro defn [name argv & body]
  (list 'def name (apply list 'fn name argv body)))

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

(defn in-mod [name]
  (.set_value
   (resolve 'piglet:lang:*current-module*)
   (ensure-module name)))

(defn reload [mod]
  (set! (.-required (ensure-module mod)) false)
  (require mod))

(defmacro cond [& args]
  (let [pairs (reverse (partition 2 args))]
    (reduce (fn [acc [test then]]
              (list 'if test then acc)) nil pairs)))

(defn count [o]
  (if (satisfies? Counted o)
    (-count o)
    (.-length (js:Array.from o))))

(defmacro when [cond & body]
  (list 'if cond (cons 'do body)))

(defn repeat [n x]
  (Repeat. n x))
