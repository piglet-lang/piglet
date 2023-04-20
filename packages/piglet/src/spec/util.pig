(module piglet:spec/util)

(defn is= [this that]
  (if (= this that)
    (println "OK")
    (println (str "Expected " this " to equal " that)))
  )

(defmacro
    testing [desc & body]
    )
