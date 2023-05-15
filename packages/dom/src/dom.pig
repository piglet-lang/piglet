(module :dom:dom)

(extend-class js:Node
  MutableCollection
  (-conj! [parent child]
    (.appendChild parent child)
    parent))

(defn el [tag-name]
  (.createElement js:document tag-name))

(defn text-node [text]
  (.createTextNode js:document text))

(defn id->el [id]
  (.getElementById js:document id))

(defn query [el qry]
  (.querySelector el qry))

(defn query-all [el qry]
  (.querySelectorAll el qry))
