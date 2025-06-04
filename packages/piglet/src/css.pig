(module css
  (:import [str :from piglet:string]))

(defprotocol Selector
  (selector-str [o] "Turn into a string"))

(defprotocol Attr
  (attr-str [o] "Turn into a string"))

(defprotocol Value
  (value-str [o] "Turn into a string"))

(extend-protocol Selector
  js:String
  (selector-str [s] s)
  js:Array
  (selector-str [s] (str:join " " (map selector-str s)))
  Keyword
  (selector-str [k] (name k)))

(extend-protocol Attr
  js:String
  (attr-str [s] s)
  Keyword
  (attr-str [k] (name k)))

(extend-protocol Value
  js:String
  (value-str [s] s)
  Keyword
  (value-str [k] (name k))
  js:Object
  (value-str [o] (str o)))

(defn render-attrs [attrs]
  (str "{"
    (str:join ";" (map (fn [[k v]] (str (attr-str k) ":" (value-str v))) attrs))
    "}"))

(declare css*)

(defn css* [[x & xs :as v]]
  (cond
    (vector? x)
    (reduce into (map css* v))

    (set? x)
    (reduce into (map #(css* (into [%] xs)) x))

    (or (string? x) (keyword? x))
    (let [sel (selector-str x)]
      (reduce
        (fn [acc r]
          (cond-> acc
            (dict? r)
            (conj [sel (render-attrs r)])
            (vector? r)
            (into (map (fn [[t a]]
                         [(str sel (if (#{">"} (first t)) "" " ") t) a])
                    (css* r)))))
        []
        xs))))

(defn css [s]
  (str:join "\n"
    (map #(str:join " " %) (css* s))))

(comment
  (css [:a {:color "green"}])
  (css [:a
        [:em {:font-weight 800 :text-decoration "underline"}]
        [:span {:color "green"}]])

  (css [[:main [#{:div :nav}
                {:color "green"}]]
        [:li {:margin "1em 0"}]])
  (css [:div [:>span {:color "red"}]])
  (css [:.foo [:.bar {:color "red"}]]))
