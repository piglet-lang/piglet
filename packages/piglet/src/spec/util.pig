(module piglet:spec/util)

(defmacro is= [this that]
  (if (= this that)
    (println "OK")
    (println (str "Expected " this " to equal " that)))
  )

(defmacro
    testing [desc & body]
    )
