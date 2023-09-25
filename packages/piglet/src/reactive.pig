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

(defn track-reactions! [this compute! update!]
  (binding [#'*reactive-context* #js []]
    (let [new-val (compute!)
          old-inputs (.-inputs this)
          new-inputs *reactive-context*]
      (set! (.-inputs this) new-inputs)
      (doseq [input (remove (set old-inputs) new-inputs)]
        (add-watch! input this (fn [k r o n] (update! o n))))
      (doseq [input (remove (set new-inputs) old-inputs)]
        (remove-watch! input this))
      new-val)))

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
        (-recompute! this))
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
      (track-reactions!
        this
        (fn []
          (reset! this (thunk)))
        (fn [old new]
          (when (not= old new)
            (-recompute! this)))))))

(defmacro formula
  "Create a formula cell, containing a computed value based on the value of
  other cells (formula or regular), which will update automatically when any of
  the dependent cells update. Macro version, see [[formula*]] for a version
  which takes a zero-arity function (thunk)"
  [& body]
  `(formula* (fn [] ~@body)))
