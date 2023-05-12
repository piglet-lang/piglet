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
        fntail (if ?name (cons ?name fntail) fntail)]
    (cons 'fn* fntail)))

(defmacro defn [name argv & body]
  (list 'def name (apply list 'fn name argv body)))

(defmacro lazy-seq [& body]
  (list 'make-lazy-seq (cons 'fn* (cons '[] body))))

(defn concat [s1 s2]
  (lazy-seq
    (let [s1 (seq s1)]
      (if s1
        (cons (first s1) (concat (rest s1) s2))
        s2))))

(defn inc [x] (+ x 1))
(defn dec [x] (- x 1))
(defn identity [x] x)
(defn into! [target source]
  (reduce conj! target source))

(defmacro doseq [binds & body]
  (let [lrs (partition 2 binds)
        ls (map first lrs)
        rs (map second lrs)
        inner-fn (cons 'do body)]
    (reduce (fn [acc [var coll]]
              (list 'reduce (list 'fn* ['_ var] acc) nil coll))
      inner-fn (reverse (map list ls rs)))))

(defmacro for [binds & body]
  (let [lrs (partition 2 binds)
        ls (map first lrs)
        rs (map second lrs)
        inner-fn (cons 'do body)
        acc-sym (gensym "acc")
        form (reduce (fn [form [var coll]]
                       (list 'reduce (list 'fn*
                                       [acc-sym var]
                                       (list
                                         (if (= form inner-fn)
                                           'conj
                                           'concat)
                                         acc-sym
                                         form))
                         []
                         coll))
               inner-fn
               (reverse (map list ls rs)))]
    form))

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

(defn slurp [path]
  (if *compiler*
    (.slurp *compiler* path)
    (throw (js:Error. "No compiler present"))))

(defn partial [f & args]
  (fn [& args2]
    (apply f (concat args args2))))

(defn update [coll k f & args]
  (assoc coll k (apply f (get coll k) args)))

(defmacro extend-class [klass & protocols]
  (let [proto-methods (reduce (fn [acc o]
                                (if (symbol? o)
                                  (conj acc [o])
                                  (update acc (dec (count acc)) conj o)))
                        []
                        protocols)]

    (cons 'do
      (for [p proto-methods]
        (list '.extend (first p) klass
          (for [fn-tail (rest p)]
            (cons 'fn fn-tail)))))))

(defmacro extend-protocol [protocol & classes]
  (let [class-methods (reduce (fn [acc o]
                                (if (symbol? o)
                                  (conj acc [o])
                                  (update acc (dec (count acc)) conj o)))
                        []
                        classes)]
    (cons '.extend
      (cons protocol
        (apply concat class-methods)))))

(extend-protocol Walkable
  js:Array [(fn -walk [this f] (js:Array.from this f))]

  js:Map [(fn -walk [this f] (into! (js:Map.) (map (fn [[k v]]
                                                     [(f k) (f v)]) this)))]
  AbstractSeq [(fn -walk [this f] (map f this))]
  Dict [(fn -walk [this f] (into {} (map (fn [[k v]] [(f k) (f v)]) this)))])

(defn postwalk [f o]
  (if (satisfies? Walkable o)
    (-walk o (partial postwalk f))
    (f o)))

(defmacro time [& body]
  (let [start (gensym "start")
        result (gensym "result")]
    (list 'let [start '(js:Date.)
                result (list 'do body)]
      (list 'println (list '- '(js:Date) start) )
      result)))
