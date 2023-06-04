(module dom)

(def *window* (when (not (=== "undefined" (typeof js:window)))
                js:window))

(defn doc []
  (.-document *window*))

(defn el [tag-name]
  (.createElement (doc) tag-name))

(defn text-node [text]
  (.createTextNode (doc) text))

(defn id->el [id]
  (.getElementById (doc) id))

(defn query [el qry]
  (.querySelector el qry))

(defn query-all [el qry]
  (.querySelectorAll el qry))

(defn extend-interfaces! []
  (extend-class (.-Node *window*)
    MutableCollection
    (-conj! [parent child]
      (.appendChild parent child)
      parent)))
