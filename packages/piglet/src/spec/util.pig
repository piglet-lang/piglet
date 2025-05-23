(module spec/util)

(def indent 0)

(defn msg [& args]
  (println (str (apply str (repeat indent " "))
             (.join (js:Array.from args) " "))))

(defmacro is [form]
  (let [[pred] form]
    `(if ~form
       (msg "\u001b[32m[OK]\u001b[0m" ~(print-str form))
       ~(cond
          (= '= pred)
          `(msg "\u001b[31m[!!]" ~form "\u001b[0m"
             "Expected" ~(print-str (nth form 2))
             "to be" ~(print-str (nth form 1))
             ", got" (print-str ~(nth form 2)))))))

(defmacro testing [& body]
  (cons 'do
    (reduce
      (fn [acc form]
        (conj acc
          (if (string? form)
            `(msg ~form)
            `(do
               (set! indent (+ indent 2))
               ~form
               (set! indent (- indent 2))))))
      `[]
      body)))
