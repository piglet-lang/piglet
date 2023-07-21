(module lang)

;; Low level bootstrapping, get enough stuff together to go from fn* to fn/defn

(def TypedArray (js:Object.getPrototypeOf js:Int8Array))

(def into (fn* [o coll] (reduce conj o coll)))

(def some (fn* [pred coll]
            (reduce (fn* [_ v]
                      (let [res (pred v)]
                        (if res (reduced res) res)))
              false
              coll)))

(def list? (fn* [o] (instance? List o)))

(def special-form?
  (fn* [o]
    (or
      (= o 'fn*)
      (= o 'def)
      (= o 'quote)
      (= o 'if)
      (= o 'defmacro)
      (= o 'await)
      (= o 'new)
      (= o 'let)
      (= o 'set!)
      (= o 'do)
      (= o 'module)
      (= o 'throw))))

(def syntax-quote*
  (fn* syntax-quote* [form gensyms]
    (if (list? form)
      (if (= 'unquote (first form))
        (second form)
        (if (some (fn* [f] (and (list? f) (= 'unquote-splice (first f)))) form)
          (cons 'concat (map (fn* [f]
                             (if (and (list? f) (= 'unquote-splice (first f)))
                               (second f)
                               [(syntax-quote* f gensyms)]))
                        form))
          (cons 'list (map (fn* [f] (syntax-quote* f gensyms)) form))))

      (if (vector? form)
        (if (some (fn* [f] (and (list? f) (= 'unquote-splice (first f)))) form)
          (list 'into []
            (cons 'concat
              (map (fn* [f]
                     (if (and (list? f) (= 'unquote-splice (first f)))
                       (second f)
                       [(syntax-quote* f gensyms)]))
                form)))
          (into []
            (map (fn* [f] (syntax-quote* f gensyms)) form)))

        (if (dict? form)
          (reduce (fn* [acc kv]
                    (println acc kv)
                    (assoc acc
                      (syntax-quote* (first kv) gensyms)
                      (syntax-quote* (second kv) gensyms)))
            {}
            form)

          (if (symbol? form)
            (if (or
                  (= "&" (name form))
                  (and (nil? (pkg-name form))
                    (= "js" (mod-name form)))
                  (special-form? form))
              (list 'quote form)
              (if (= "#" (last (name form)))
                (let [sym-name (.replace (name form) "#" "")
                      gsym (get gensyms sym-name (gensym sym-name))]
                  (assoc! gensyms sym-name gsym)
                  (list 'quote gsym))

                (if (= "." (last (name form)))
                  (let [vname (.slice (name form) 0 -1)
                        var (resolve (symbol vname))]
                    (if var
                      (list 'quote (symbol (str (.-fqn var) ".")))
                      (list 'quote form)))
                  (let [var (resolve form)]
                    (if var
                      (list 'quote (.-fqn var))
                      (if (= "." (first (name form)))
                        (list 'quote form)
                        (list 'quote (qsym (str *current-module* ":" form)))))))))

            (if (object? form)
              (reduce
                (fn* [acc kv]
                  (assoc! acc (first kv) (syntax-quote* (second kv) gensyms)))
                #js {}
                (js:Object.entries form))

              (list 'quote form))))))))

(defmacro syntax-quote [form]
  (syntax-quote* form #js {}))

(defmacro undefined? [o]
  `(=== (typeof ~o) "undefined"))

(defmacro fn [?name argv & body]
  (let [[?name argv body] (if (symbol? ?name)
                            [?name argv body]
                            [nil ?name (if (undefined? argv)
                                         []
                                         (cons argv body))])
        argv-clean (remove (fn* [a] (= a (symbol "&"))) argv)
        syms (map (fn* [a]
                    (if (= a (symbol "&"))
                      a
                      (gensym "arg"))) argv)
        syms (with-meta syms (meta argv))
        syms-clean (remove (fn* [a] (= a (symbol "&"))) syms)
        fntail (if (seq body)
                 (list syms
                   (apply list 'let (reduce into [] (map (fn* [bind arg] [bind arg]) argv-clean syms-clean))
                     body))
                 (list syms))
        fntail (if ?name (cons ?name fntail) fntail)]
    (cons 'fn* fntail)))

(def vary-meta (fn* vary-meta [obj f & args]
                 (with-meta obj (apply f (meta obj) args))))

(defmacro defn [name doc-string? argv & body]
  (let [[doc-string? argv body] (if (string? doc-string?)
                                  [doc-string? argv body]
                                  [nil doc-string? (cons argv body)])]
    `(def ~(vary-meta
             (if doc-string?
               (vary-meta name assoc :doc doc-string?)
               name)
             into
             (dissoc (meta argv) :start :end :col :line))
       ;; can't use ~@body here because concat is not yet defined
       (fn ~name ~argv ~(cons 'do body)))))

(defmacro cond [& args]
  (let [pairs (reverse (partition 2 args))]
    (reduce (fn [acc [test then]]
              `(if ~test ~then ~acc)) nil pairs)))

(defmacro lazy-seq [& body]
  ;; can't use ~@body here because concat is not yet defined
  `(make-lazy-seq (fn* [] ~(cons 'do body))))

(defn concat
  "Return a lazy seq by concatenating the items of two or
   more sequences."
  [s1 s2 & more]
  (if (seq more)
    (concat s1 (apply concat s2 more))
    (lazy-seq
      (let [s1 (seq s1)]
        (if s1
          (cons (first s1) (concat (rest s1) s2))
          (seq s2))))))

(defn inc
  "Return the increment (by 1) of the supplied number."
  [x] (+ x 1))

(defn dec
  "Return the decrement (by 1) of the supplied number."
  [x] (- x 1))

(defn identity
  "Return the argument supplied as is."
  [x] x)

(defn into! [target source]
  (reduce conj! target source))

(defmacro doseq [binds & body]
  (let [lrs (partition 2 binds)
        ls (map first lrs)
        rs (map second lrs)
        inner-fn `(do ~@body)]
    (reduce (fn [form [var coll]]
              (cond
                (and (keyword? var)
                  (= :when var))
                `(when ~coll
                   ~form)

                (= :let var)
                `(let ~coll ~form)

                :else
                `(reduce (fn [_# ~var] ~form) nil ~coll)))
      inner-fn
      (reverse (map list ls rs)))))

(defmacro dotimes [binding & body]
  (let [[bind num] binding]
    `(doseq [~bind (range ~num)]
       ~@body)))

(defn -for-sync [binds body]
  (let [lrs (partition 2 binds)
        ls (map first lrs)
        rs (map second lrs)
        result (gensym "result")
        inner-fn `(conj! ~result ~@body)]
    `(let [~result #js []]
       (doseq ~binds ~inner-fn)
       (apply list ~result))))

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

(defn macroexpand
  "Returns the expanded form of a macro form. The form
   has to be a list (quoted) so that it is not evaluated."
  ^{:examples
    '[(macroexpand '(when true 10)) => '(if true (do 10))
      (macroexpand '(if-let [x 3] (inc x) 0)) => '(let [x 3] (if x (inc x) 0))]}
  [form]
  (apply (resolve (first form)) (rest form)))

(defn in-mod [name]
  (.set_value
    (resolve 'piglet:lang:*current-module*)
    (ensure-module name)))

(defn reload [mod]
  (set! (.-required (ensure-module mod)) false)
  (require mod))

(defmacro when [cond & body]
  `(if ~cond (do ~@body)))

(defmacro if-let [binding if-true if-false]
  `(let ~binding
     (if ~(first binding)
       ~if-true
       ~if-false)))

(defmacro when-let [binding & body]
  `(if-let ~binding
     (do ~@body)
     nil))

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

(defn update-in [coll path f & args]
  (if (= 1 (count path))
    (apply update coll (first path) f args)
    (apply update-in coll (butlast path) update (last path) f args)))

(defn update! [coll k f & args]
  (assoc! coll k (apply f (get coll k) args)))

(defn update-in! [coll path f & args]
  (if (= 1 (count path))
    (apply update! coll (first path) f args)
    (apply update-in! coll (butlast path) update (last path) f args)))

(defn assoc-in [coll path v]
  (update-in coll (butlast path) assoc (last path) v))

(defn assoc-in! [coll path v]
  (update-in! coll (butlast path) assoc! (last path) v))

(defn into-array [o]
  (js:Array.from o))

;; Protocols

(defmacro extend-type [klass & protocols]
  (let [proto-methods (reduce (fn [acc o]
                                (if (symbol? o)
                                  (conj acc [o])
                                  (update acc (dec (count acc)) conj o)))
                        []
                        protocols)]

    (cons 'do
      (for [p proto-methods]
        (list '.extend (first p) klass
          (into-array
            (for [fn-tail (rest p)]
              (cons 'fn fn-tail))))))))

(defmacro defprotocol [proto-name & methods]
  `(.intern
     (Protocol.
       ~(meta proto-name)
       ~(.-fqn (.-fqn *current-module*))
       ~(name proto-name)
       ~(js:Array.from
          (for [[method-name argv doc] methods]
            ;; TODO: multiple arities
            (let [arities #js [#js [(js:Array.from argv name) (or doc nil)]]]
              #js [(name method-name) arities]))))
     *current-module*))

(defmacro extend-protocol [protocol & classes]
  (let [class-methods (reduce (fn [acc o]
                                (if (symbol? o)
                                  (conj acc [o []])
                                  (update-in acc [(dec (count acc)) 1] conj
                                    ;; FIXME: Protocol#extend uses the name of
                                    ;; this function to determine which protocol
                                    ;; method it implements, in others words, we
                                    ;; have to retain the name here. But that
                                    ;; means that we define a named function
                                    ;; which (inside itself) shadows the
                                    ;; protocol method

                                    ;; (extend-protocol Foo Type (-foo [this] (-foo 123)))

                                    ;; This inner call to -foo will not dispatch
                                    ;; via the protocol, it will always resolve
                                    ;; to the implementation for Type, which is
                                    ;; not what we want.

                                    ;; The easiest way to fix this might be to
                                    ;; walk over the function form (o), and turn
                                    ;; any references to the protocol method
                                    ;; into fully-qualified symbols, although
                                    ;; that's also not trivial to figure out for
                                    ;; the general case, unless we enforce that
                                    ;; the protocol parameter to this macro has
                                    ;; to be a symbol that resolves to the
                                    ;; protocol itself, rather than an arbitrary
                                    ;; value that evaluates to the protocol.

                                    ;; or we eval protocol inside the macro,
                                    ;; which we should be able to do since the
                                    ;; runtime should reflect the compiled
                                    ;; module/var structure, but it still seems
                                    ;; messy.

                                    ;; Or we rewire how Protocol#extend works,
                                    ;; taking the method names explicitly,
                                    ;; rather than unmunging them from the
                                    ;; function names. Might be the cleaner
                                    ;; option.
                                    `(fn ~@o))))
                                    []
                                    classes)]
    `(.extend
       ~protocol
       ~@(apply concat class-methods))))


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

(defprotocol HasKey
  (has-key? [this k]))

(extend-protocol HasKey
  Dict
  (has-key? [d k]
    (.has d k)))

;; More API in no particular order

(defmacro time [& body]
  `(let [start# (js:Date.)
         result# (do ~@body)]
     (println (- (js:Date.) start#) "ms")
     result#))

(defn comp [& fns]
  (fn [& args]
    (let [fns (reverse fns)]
      (reduce (fn [acc f]
                (f acc))
        (apply (first fns) args)
        (rest fns)))))

(def not= (comp not =))

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
  (map
    (fn [x]
      (if (= 1 (count x))
        (first x)
        x))
    (.matchAll s (if (instance? js:RegExp re)
                   (if (.-global re)
                     re
                     (js:RegExp. (.-source re) (str (.-modifiers re) "g")) )
                   (js:RegExp. re "g")))))

(defn re-find [re s]
  (first (re-seq re s)))

(defn load-package [pkg-loc]
  (.then (.load_package *compiler* pkg-loc)
    (fn [pkg]
      (set! *current-package* pkg)
      pkg)))

(defn number? [v]
  (not (js:isNaN v)))

(defn juxt
  [& fns]
  (fn [& args]
    (reduce (fn [acc f]
              (conj acc (apply f args)))
      []
      fns)))

(defn mapcat [f coll]
  (reduce (fn [acc c]
            (into acc (f c)))
    []
    coll))

(defmacro comment [& _]
  nil)

(defn boolean? [o]
  (or
    (=== true o)
    (=== false o)))

(defn object [& kvs]
  (apply assoc! #js {} kvs))

(defn type-name [o]
  (when (.-constructor o)
    (.-name (.-constructor o))))

(defmacro doto [o & forms]
  (let [sym (gensym "o")]
    (concat
      (list 'let [sym o])
      (for [f forms]
        (if (list? f)
          (cons (first f) (cons sym (rest f)))
          (list f sym)))
      [sym])))

;; Lazy version with Proxy
(defn ->js [o]
  (cond
    (dict? o)
    (js:Proxy. #js {}
      #js {:apply (fn [_ this args]
                    (apply o args))
           :has (fn [_ prop]
                  (or
                    (has-key? o prop)
                    (and (string? prop)
                      (has-key? o (keyword prop)))))
           :get (fn [_ prop _]
                  (cond
                    (has-key? o prop)
                    (->js (get o prop))
                    (and (string? prop)
                      (has-key? o (keyword prop)))
                    (->js (get o (keyword prop)))))
           :getOwnPropertyDescriptor (fn [_ prop]
                                       (cond
                                         (has-key? o prop)
                                         #js {:enumerable true
                                              :configurable true
                                              :writable false
                                              :value (->js (get o prop))}
                                         (and (string? prop)
                                           (has-key? o (keyword prop)))
                                         #js {:enumerable true
                                              :configurable true
                                              :writable false
                                              :value (->js (get o (keyword prop)))}) )
           :ownKeys (fn [_]
                      (js:Array.from (map name (keys o))))})

    (sequential? o)
    (into-array (map ->js o))

    :else
    o))

;; Eager version
;; #_(defn ->js [o]
;;     (cond
;;       (or
;;         (nil? o)
;;         (number? o)
;;         (string? o)
;;         (boolean? o))
;;       o

;;       (dict? o)
;;       (let [obj #js {}]
;;         (doseq [[k v] o]
;;           (assoc! obj (if (or
;;                           (instance? js:Symbol k)
;;                           (string? k))
;;                       k
;;                       (name k))
;;             (->js v)))
;;         obj)

;;       (sequential? o)
;;       (js:Array.from o ->js)

;;       :else
;;       (str o)))

(defmacro -with-cache [cache key body]
  `(if-let [val# (get @~cache ~key)]
     val#
     (let [val# ~body]
       (swap! ~cache assoc ~key val#)
       val#)))

(defn reference [v]
  (specify! #js {:val v}
    Swappable
    (-swap! [this f args]
      (set! (.-val this) (apply f (.-val this) args)))
    Derefable
    (deref [this]
      (.-val this))
    TaggedValue
    (-tag [this] "reference")
    (-tag-value [this] (.-val this))))

(defn constantly [v]
  (fn* [] v))

(defn reset! [r v]
  (swap! r (constantly v)))

(defn ->pig [o opts]
  (let [opts (or opts {:exclude [js:Date TypedArray]})]
    (cond
      (and
        (object? o)
        (not (some (fn [t]
                     (instance? t o)) (:exclude opts))))
      (let [cache (reference {})
            realize-dict (fn [] (-with-cache cache :dict
                                  (into {}
                                    (map (fn [[k v]] [(keyword k) (->pig v)])
                                      (js:Object.entries o)))))]
        (reify
          DictLike
          (-keys [_] (-with-cache cache :keys (map keyword (js:Object.keys o))))
          (-vals [_] (vals (realize-dict)))
          Associative
          (-assoc [_ k v]
            (assoc (realize-dict)
              k v))
          Lookup
          (-get [_ k] (-with-cache cache [:key k] (->pig (get o k))))
          (-get [_ k v] (if (js:Object.hasOwn o (name k))
                          (-with-cache cache [:key k] (->pig (get o k)))
                          v))
          Conjable
          (-conj [this [k v]] (assoc this k v))
          Counted
          (-count [_] (.-length (js:Object.keys o)))
          ;; FIXME: a call like `(-repr ...)` here would call this specific
          ;; implementation function, instead of the protocol method, thus causing
          ;; infinite recursion.
          ;; FIXME: we have a built-in, non-overridable package alias for piglet, we
          ;; should probably also add a default but overridable module alias to
          ;; `lang`
          Repr
          (-repr [this] (piglet:lang:-repr (realize-dict)))
          Seqable
          (-seq [_]
            (-with-cache cache :seq
              (let [entries (js:Object.entries o)]
                (when (not= 0 (.-length entries))
                  (map (fn [[k v]] [(keyword k)
                                    (->pig v)])
                    entries)))))))

      (array? o)
      (lazy-seq (map ->pig o))

      :else
      o)))

(defn take [n coll]
  (when (and (seq coll) (< 0 n))
    (cons (first coll)
      (lazy-seq (take (dec n) (rest coll))))))

(defn drop [n coll]
  (if (<= n 0)
    coll
    (drop (dec n) (rest coll))))

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

(defn boolean [b]
  (not (not b)))

(defn empty? [coll]
  (if (satisfies? Empty coll)
    (-empty? coll)
    (boolean (seq coll))))

(defn select-keys [m keyseq]
  (into {} (map (fn [k] [k (get m k)]) keyseq)))

(defn apropos [mod s]
  (if (undefined? s)
    (apropos 'piglet:lang mod)
    (filter (fn [n]
              (.includes n s))
      (map (fn [v] (.-name v))
        (vals
          (if (instance? Module mod)
            mod
            (find-module mod)))))))

(defn run! [f coll]
  (reduce (fn [_ o]
            (f o)) nil coll)
  nil)

(defn sort [coll]
  (.sort (into-array coll)))

(defn identifier? [i]
  (instance? AbstractIdentifier i))

(defn get-in [o path fallback]
  (if (= 1 (count path))
    (get o (first path) (if (undefined? fallback)
                          nil
                          fallback))
    (get-in (get o (first path)) (rest path) fallback)))

(defmacro defonce [sym form]
  `(when (not (resolve '~sym))
     (def ~sym ~form)))

(defn rand-int [n]
  (js:Math.floor (* n (js:Math.random))))

(defn rand-nth [coll]
  (nth coll (rand-int (count coll))))

(defn fnil [f arg]
  (fn [x & xs]
    (if (nil? x)
      (apply f arg xs)
      (apply f x xs))))

(defn frequencies [coll]
  (reduce (fn [acc el]
            (update acc el (fnil inc 0)))
    {}
    coll))

(defn repeatedly [f]
  (cons (f) (lazy-seq (repeatedly f))))

(defn merge [m & ms]
  (reduce into m ms))

(defn keep [f & colls]
  (filter identity
    (apply map f colls)))

;; TODO: support for hierarchies
(defmacro defmulti [name key-fn]
  `(def ~name (let [key-fn# ~key-fn
                    methods# (reference {})
                    ;; FIXME why is this specify not working
                    dispatch# (specify! (fn ~'dispatch [arg# & args#]
                                          (let [v# (key-fn# arg#)]
                                            (if-let [m# (get @methods# v#)]
                                              (apply m# arg# args#)
                                              (if-let [m# (:default @methods#)]
                                                (apply m# arg# args#)
                                                (throw (js:Error. (str "No method found in " '~name " for dispatch value " v#)))))))
                                Repr
                                (-repr [this]
                                  (str "<Multimethod " '~name ">")))]
                (set! (.-methods dispatch#) methods#)
                dispatch#)))

(defmacro defmethod [name val & fn-tail]
  `(swap! (:methods ~name)
     assoc ~val (fn ~@fn-tail)))

(defmacro binding [bindings & body]
  `(do
     ~@(for [[var val] (partition 2 bindings)]
         `(.push_binding ~var ~val))
     (let [res# (do ~@body)]
       ~@(for [[var _] (partition 2 bindings)]
           `(.pop_binding ~var))
       res#)))

(defmacro declare [& syms]
  `(do
     ~@(for [sym syms]
         `(def ~sym nil))))

(defn distinct [coll]
  (let [seen? (reference #{})]
    (seq
      (reduce (fn [acc el]
                (if (@seen? el)
                  acc
                  (do
                    (swap! seen? conj el)
                    (conj acc el))))
        []
        coll))))

;; Function versions of all operators, for use in higher order functions
(defmacro define-operator-functions []
  `(do
     ~@(for [op '[+ * / < > >= <= mod power == === instance?
                  and or bit-shift-left bit-shift-right bit-and bit-or bit-xor]]
         `(intern '~op
            (fn [& args#]
              (reduce (fn [a# b#] (~op a# b#)) args#))))))

(define-operator-functions)

(defn parse-identifier
  "Parse a string to a suitable type of identifier, similar to how the Piglet
  reader treats identifiers. Will return one of QName, PrefixName, Keyword,
  QSym, Sym"
  [s]
  (if (= ":" (first s))
    (let [s (.substring s 1)]
      (if (.includes s ":")
        (if (.includes s "://")
          (qname s)
          (prefix-name s))
        (keyword s)))
    (if (.includes s ":")
      (if (.includes s "://")
        (qsym s)
        (symbol s))
      (symbol s))))
