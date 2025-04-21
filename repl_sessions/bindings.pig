(module foo
  (:import [astring :from "astring"]) )

(do
  (def ana (.-analyzer *compiler*))

  (set! ana.ff true)

  #_(map astring:generate
      (.emit
      (.analyze ana '(let [[x] [1]] (let [y 3] y) ) )
      (.-code_gen *compiler*)))

  (map astring:generate
    (.emit
      (.analyze ana
        '(loop [x 1]
           (when (< x 10)
             (recur (inc x)))))
      (.-code_gen *compiler*))))
