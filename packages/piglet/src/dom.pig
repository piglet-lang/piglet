(module dom)

(defn extend-interfaces! [window]
  (extend-class (.-Node window)
    MutableCollection
    (-conj! [parent child]
      (.appendChild parent child)
      parent)))

(defn create-el [doc xmlns tag]
  (if xmlns
    (.createElementNS doc xmlns tag)
    (.createElement doc tag)))

(defn fragment [doc els]
  (let [fragment (.createDocumentFragment doc)]
    (doseq [el els]
      (.appendChild fragment el))
    fragment))

(defn text-node [doc text]
  (.createTextNode doc text))

(defn comment [doc text]
  (.createComment doc text))

(defn find-by-id [doc id]
  (.getElementById doc id))

(defn query [el qry]
  (.querySelector el qry))

(defn query-all [el qry]
  (.querySelectorAll el qry))

(defn set-attr [el k v]
  (cond
    (and (= :style k) (dict? v))
    (doseq [[prop val] v]
      (.setProperty (.-style el) (name prop) val))

    :else
    (.setAttribute el (name k) v))
  el)

(defn set-attrs [el kvs]
  (doseq [[k v] kvs]
    (set-attr el k v))
  el)

(defn attr [el k]
  (.getAttribute el (name k)))

(defn parent [el] (.-parentElement el))
(defn children [el] (.-children el))
(defn child-nodes [el] (.-childNodes el))
(defn first-child [el] (.-firstChild el))
(defn last-child [el] (.-lastChild el))
(defn first-el-child [el] (.-firstElementChild el))
(defn last-el-child [el] (.-lastElementChild el))
(defn next-sibling [el] (.-nextSibling el))

(defn inner-html [el] (.-innerHTML el))
(defn outer-html [el] (.-outerHTML el))

(defn append-child [el child] (.appendChild el child) el)
(defn append [el & children] (apply (.bind (.-append el) el) children) el)
(defn prepend [el & children] (apply (.bind (.-prepend el) el) children) el)

(defn split-tag [tag]
  (let [tag-str (or (.-suffix tag) (name tag))
        tag-name (re-find "[^#\\.]+" tag-str)
        id (re-find "[#][^#\\.]+" tag-str) ;; currently not supported in the reader for keywords, works for strings
        kls (re-seq "[\\.][^#\\.]+" tag-str)]
    [(.-base tag)
     tag-name
     (when id (.substring id 1))
     (map (fn [s] (.substring s 1)) kls)]))

;; FIXME (defn spit-el [[tag & tail]] ,,,)
(defn split-el [form]
  (let [tag (first form)
        tail (rest form)
        [tag-ns tag id kls] (split-tag tag)]
    [(or tag-ns nil)
     tag
     (cond-> (if (dict? (first tail))
               (first tail)
               {})
       id
       (assoc :id id)
       (seq kls)
       (update :class str kls))
     (if (dict? (first tail))
       (rest tail)
       tail)]))

(defn dom [doc form]
  (cond
    (and (object? form) (.-nodeType form)) ;; quacks like a Node
    form

    (or (string? form) (number? form))
    (.createTextNode doc (str form))

    (vector? form)
    (cond
      (= :<> (first form))
      (dom doc (rest form))

      (or
        (keyword? (first form))
        (qname? (first form)))
      (let [[tag-ns tag attrs children] (split-el form)
            el (create-el doc tag-ns tag)]
        (set-attrs el attrs)
        (when (seq children)
          (append-child el (dom doc children)))
        el)

      (fn? (first form))
      (dom doc (apply (first form) (rest form))))

    (seq? form)
    (fragment doc (map (partial dom doc) form))

    :else
    (dom doc (str form))))
