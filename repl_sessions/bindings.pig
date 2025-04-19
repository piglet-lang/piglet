(module foo
  (:import [astring :from "astring"]) )
(do
  (def ana (.-analyzer *compiler*))

  (set! ana.ff true)

  (map astring:generate
    (.emit
      (.analyze ana '(let [[x] [1]] (let [y 3] y) ) )
      (.-code_gen *compiler*))))
