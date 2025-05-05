(module foo
  (:import [astring :from "astring"]) )

(do
  (def ana (.-analyzer *compiler*))

  (set! ana.ff true)

  (map astring:generate
    (.emit
      (.analyze ana '(let [[x] [1]] (let [y 3] y) ) )
      (.-code_gen *compiler*)))
  #_
  (map astring:generate
    (.emit
      (.analyze ana
        '(loop [x 1]
           (when (< x 10)
             (recur (inc x)))))
      (.-code_gen *compiler*))))

(let [cmdspec :cmdspec
      cli-args ["a" "b" "c"]
      opts {:x 1}]
  (loop [cmdspec          cmdspec
         [arg & cli-args] cli-args
         args             []
         seen-prefixes    #{}
         opts             opts]
    ;; Handle additional flags by nested commands
    (let [opts        (assoc opts :y 2)
          cmdspec     [:cmdspec cmdspec]]
      #_{:cmdspec          cmdspec
         :arg arg
         :cli-args cli-args
         :args args
         :seen-prefixes seen-prefixes
         :opts             opts}
      (when (seq cli-args)
        (recur
          cmdspec
          cli-args
          args
          seen-prefixes
          opts)))))
