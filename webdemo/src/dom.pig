(module :webdemo:dom)

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
