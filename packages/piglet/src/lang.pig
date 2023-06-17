(module lang)

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

(defn concat [s1 s2 & more]
  (if (seq more)
    (concat s1 (apply concat s2 more))
    (lazy-seq
      (let [s1 (seq s1)]
        (if s1
          (cons (first s1) (concat (rest s1) s2))
          (seq s2))))))

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
              (list 'reduce (list 'fn ['_ var] acc) nil coll))
      inner-fn (reverse (map list ls rs)))))

(defn -for-sync [binds body]
  (let [lrs (partition 2 binds)
        ls (map first lrs)
        rs (map second lrs)
        inner-fn (cons 'do body)
        acc-sym (gensym "acc")
        form (reduce (fn [form [var coll]]
                       (list 'reduce (list 'fn
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
    (list 'seq form)))

(defn -for-async [binds body]
  (let [lrs (partition 2 binds)
        ls (map first lrs)
        rs (map second lrs)
        inner-fn (cons 'do body)
        acc-sym (gensym "acc")
        form (reduce (fn [form [var coll]]
                       (list 'reduce (list 'fn '^:async for-fn [acc-sym var]
                                       (list
                                         (if (= form inner-fn)
                                           'conj
                                           'concat)
                                         (list 'await acc-sym)
                                         form))
                         []
                         coll))
               inner-fn
               (reverse (map list ls rs)))]
    form))

(defmacro for [binds & body]
  (if (:async (meta binds))
    (-for-async binds body)
    (-for-sync binds body)))

(defn macroexpand [form]
  (apply (resolve (first form)) (rest form)))

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

(defn spit [path content]
  (if *compiler*
    (.spit *compiler* path content)
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

(defmacro specify! [object & protocols]
  (let [proto-methods (reduce (fn [acc o]
                                (if (symbol? o)
                                  (conj acc [o])
                                  (update acc (dec (count acc)) conj o)))
                        []
                        protocols)
        osym (gensym "object")]
    (list 'let [osym object]
      (cons 'do
        (for [p proto-methods]
          (list '.extend_object (first p) osym
            (into [] (for [fn-tail (rest p)]
                       (cons 'fn fn-tail))))))
      osym)))

(defmacro reify [& protocols]
  (cons 'specify! (cons #js {} protocols)))

(defmacro time [& body]
  (let [start (gensym "start")
        result (gensym "result")]
    (list 'let [start '(js:Date.)
                result (list 'do body)]
      (list 'println (list '- '(js:Date) start) )
      result)))

(defn != [x & xs]
  (not (apply = x xs)))

(defmacro -> [x & forms]
  (reduce (fn [acc form]
            (if (sequential? form)
              (apply list (first form) acc (rest form))
              (list form acc)))
    x
    forms))

(defmacro ->> [x & forms]
  (reduce (fn [acc form]
            (if (sequential? form)
              (concat form (list acc))
              (list form acc)))
    x
    forms))

(defmacro cond-> [x & forms]
  (let [pairs (partition 2 forms)]
    (reduce (fn [acc [pred form]]
              (let [acc-sym (gensym "acc")]
                (list 'let [acc-sym acc]
                  (list 'if pred (if (sequential? form)
                                   (apply list (first form) acc-sym (rest form))
                                   (list form acc-sym))
                    acc-sym))))
      x pairs)))

(defn re-seq [re s]
  (.match s (if (instance? js:RegExp re)
              re
              (js:RegExp. re "g"))))

(defn re-find [re s]
  (first (re-seq re s)))

;; separator first, for partial application
(defn join [sep strings]
  (.join strings sep))

(defn split [sep string]
  (.split string sep))

(defn load-package [pkg-loc]
  (.load_package *compiler* pkg-loc))

(defn number? [v]
  (not (js:isNaN v)))

(defn comp [& fns]
  (fn [v]
    (reduce (fn [acc f]
              (f acc))
      v (reverse fns))))

(defn mapcat [f coll]
  (reduce (fn [acc c]
            (into acc (f c)))
    []
    coll))

(defmacro comment [& _]
  nil)

(defn list? [o]
  (instance? List o))

(defn boolean? [o]
  (or
    (=== true o)
    (=== false o)))

(defn object [& kvs]
  (let [o #js {}]
    (doseq [[k v] (partition 2 kvs)]
      (oset o (if (or
                    (instance? js:Symbol k)
                    (string? k))
                k
                (name k))
        v))))

(defn object? [o]
  (and
    (not (nil? o))
    (not (array? o))
    (= "object" (typeof o))))

(defn oassoc [o & kvs]
  (let [o (js:Object.assign #js {} o)]
    (doseq [[k v] (partition 2 kvs)]
      (oset o k v)
      o)))

(defn type-name [o]
  (and (object? o)
    (.-constructor o)
    (.-name
      (.-constructor o))))

(defn ->js [o]
  (println "CONVERTING" o)
  (cond
    (or
      (nil? o)
      (number? o)
      (string? o)
      (boolean? o))
    o

    (dict? o)
    (let [obj #js {}]
      (doseq [[k v] o]
        (oset obj (if (or
                        (instance? js:Symbol k)
                        (string? k))
                    k
                    (name k))
          (->js v)))
      obj)

    (sequential? o)
    (js:Array.from o ->js)

    :else
    (str o)))

(defn ->pig [o]
  (cond
    ;; Convert plain JSON-like objects, leave constructed objects alone
    (and
      (object? o)
      (or
        (nil? (.-constructor o))
        (= js:Object (.-constructor o))))
    (reify
      DictLike
      (-keys [_] (map keyword (js:Object.keys o)))
      (-vals [_] (map ->pig (js:Object.values o)))
      Associative
      (-assoc [_ k v]
        (if (or (string? k) (keyword? k))
          (->pig (oassoc o k v))
          (assoc
            (into {} (map (fn [[k v]] [(keyword k) (->pig v)]))
              (js:Object.entries o))
            k v)))
      Lookup
      (-get [_ k] (->pig (oget o k)))
      (-get [_ k v] (->pig (oget o k v)))
      Conjable
      (-conj [this [k v]] (assoc this k v))
      Counted
      (-count [_] (.-length o))
      ;; FIXME: a call like `(-repr ...)` here would call this specific
      ;; implementation function, instead of the protocol method, thus causing
      ;; infinite recursion.
      ;; FIXME: we have a built-in, non-overridable package alias for piglet, we
      ;; should probably also add a default but overridable module alias to
      ;; `lang`
      Repr
      (-repr [this] (piglet:lang:-repr (into {} this)))
      Seqable
      (-seq [_]
        (seq (map (fn [[k v]] [(keyword k)
                               (->pig v)])
               (js:Object.entries o)))))

    (array? o)
    (lazy-seq (map ->pig o))

    :else
    o))

(defn take [n coll]
  (when (and (seq coll) (< 0 n))
    (cons (first coll)
      (lazy-seq (take (dec n) (rest coll))))))

;; FIXME: replace once we have real vectors
(defn vector [& args]
  (js:Array.from args))

;; FIXME: replace once we have real vectors
(defn mapv [f & colls]
  (js:Array.from (apply map f colls)))

(defn min [& vals]
  (reduce (fn [a b]
            (if (< a b) a b))
    vals))

(defn max [& vals]
  (reduce (fn [a b]
            (if (< a b) b a))
    vals))

(def ffirst (comp first first))
(def not= (comp not =))

(defmacro doto [o & forms]
  (let [sym (gensym "o")]
    (concat
      (list 'let [sym o])
      (for [f forms]
        (if (list? f)
          (cons (first f) (cons sym (rest f)))
          (list f sym)))
      [sym])))

(defn boolean [b]
  (not (not b)))

(defn empty? [coll]
  (if (satisfies? Empty coll)
    (-empty? coll)
    (boolean (seq coll))))
