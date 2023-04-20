(module hiccup)

(defn html [arg]
  (if (string? arg)
    arg
    (if (sequential? arg)
      (let [[tag props] arg
            children (if (dict? props) (rest (rest arg)) (rest arg))
            props (if (dict? props) props {})]
        (str "<" (name tag) ">" (apply str (map html children))
             "</" (name tag) ">")))))
