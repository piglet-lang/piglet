(module reactive
  "Reactive primitives for UI programming")

(def ^:dynamic *reactive-context*
  "Bind to a JS array to track `deref`s of reactive cells. Any cell that is
  derefed will push itself onto the array, and can subsequently be watched. "
  nil)

(defn cell
  "Reactive container. Like [[box]], but can participate in a reactive signal
  graph. See also [[formula]]. Takes the initial value as argument."
  [v]
  (specify! #js {:val v
                 :watches {}
                 :notify #{}}
    Swappable
    (-swap! [this f args]
      (let [old-val (.-val this)
            new-val (apply f old-val args)]
        (set! (.-val this) new-val)
        (doseq [[k f] (.-watches this)]
          (f k this old-val new-val))
        new-val))
    Derefable
    (deref [this]
      (when *reactive-context*
        (.push *reactive-context* this))
      (.-val this))
    TaggedValue
    (-tag [this] "cell")
    (-tag-value [this] (.-val this))
    Watchable
    (add-watch! [this key watch-fn]
      (set! (.-watches this) (assoc (.-watches this) key watch-fn))
      this)
    (remove-watch! [this key]
      (set! (.-watches this) (dissoc (.-watches this) key))
      this)))

(defprotocol Formula
  (-recompute! [this]))

(defn formula* [thunk]
  (specify! #js {:val ::new
                 :watches {}
                 :inputs #js []}
    Swappable
    (-swap! [this f args]
      (let [old-val (.-val this)
            new-val (apply f old-val args)]
        (set! (.-val this) new-val)
        (doseq [[k f] (.-watches this)]
          (f k this old-val new-val))
        new-val))
    Derefable
    (deref [this]
      (when (= ::new (.-val this))
        (binding [#'*reactive-context* #js []]
          (let [new-val (thunk)
                inputs *reactive-context*]
            (set! (.-inputs this) inputs)
            (reset! this new-val)
            (doseq [input inputs]
              (add-watch! input this (fn [k r o n] (-recompute! this)))))))
      (when *reactive-context*
        (.push *reactive-context* this))
      (.-val this))

    TaggedValue
    (-tag [this] "formula")
    (-tag-value [this] (.-val this))

    Watchable
    (add-watch! [this key watch-fn]
      (set! (.-watches this) (assoc (.-watches this) key watch-fn))
      this)
    (remove-watch! [this key]
      (set! (.-watches this) (dissoc (.-watches this) key))
      this)

    Formula
    (-recompute! [this]
      (binding [#'*reactive-context* #js []]
        (let [new-val (thunk)
              old-inputs (.-inputs this)
              new-inputs *reactive-context*]
          (set! (.-inputs this) new-inputs)
          (reset! this new-val)
          (doseq [input (remove (set old-inputs) new-inputs)]
            (add-watch! input this (fn [k r o n] (-recompute! this))))
          (doseq [input (remove (set new-inputs) old-inputs)]
            (remove-watch! input this)))))))

(defmacro formula [& body]
  `(formula* (fn [] ~@body)))

(defmacro formula! [& body]
  `(let [f# (formula* (fn [] ~@body))]
     @f#
     f#))

(comment
  (def !a (cell 1))

  (swap! !a inc)

  (def !f (formula!
            (let [s (str @!a)]
              (println s)
              s)))

  (def !g (formula (str "--" @!f "--")))

  (deref !g)

  (add-watch! !f :foo (fn [k r o n]
                        (println :UPDATE k r o n))))
