(module cli/port
  (:import [str :from string]))

(defn transpose [m]
  (apply mapv vector m))

(defn print-table
  [rows {:keys [pad] :or {pad 2}}]
  (when (seq rows)
    (let [col-widths (map
                       (fn [o] (apply max (map (comp count str) o)))
                       (transpose rows))]
      (doseq [row rows]
        (println
          (str:join ""
            (map (fn [o w] (+ (str:join (repeat 2 " ")))(.padRight (str o) w)) row col-widths))))
      )))
(str:join " " (repeat 2 " "))
(get (:or '{:keys [pad] :or {pad 2}}) 'pad)

(print-table [["hello" "world"]
              [1 2]]
)

(set! *verbosity* 3)

(meta (fn [& _] 2))

(analyze )

fstr (string:join "   " (map (fn [o] (str  "%" (if (= 0 o) "" (- o))  "s")) col-widths))
(doseq [row rows]
        (println (apply format (str (format (str "%" pad "s") "") fstr) row)))
