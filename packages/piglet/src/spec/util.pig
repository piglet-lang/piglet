(module spec/util)

(def indent 0)

(defn msg [& args]
  (println (str (apply str (repeat indent " "))
                (.join (js:Array.from args) " "))))

(defmacro is [form]
  (list 'if form
        (list 'spec/util:msg "[OK]" (print-str form))
        (let [[pred] form]
          (cond
            (= '= pred)
            (list 'spec/util:msg "[!!]" form
                  "Expected" (print-str (nth form 2))
                  "got" (nth form 1))))))

(defmacro testing [desc & body]
  (list 'do
        (list 'spec/util:msg desc)
        (list 'set! 'spec/util:indent (+ indent 2))
        (cons 'do body)
        (list 'set! 'spec/util:indent (- indent 2))
        ))
