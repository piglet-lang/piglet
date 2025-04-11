(module cli/port
  (:import [str :from string]))

(defn transpose [m]
  (apply mapv vector m))

(defn print-table
  ([rows]
    (print-table rows {}))
  ([rows {:keys [pad] :or {pad 2}}]
    (when (seq rows)
      (let [col-widths (map
                         (fn [o] (apply max (map (comp count str) o)))
                         (transpose rows))]
        (doseq [row rows]
          (println
            (str:join ""
              (map (fn [o w]
                     (str (str:join (repeat 2 " ")) (str:pad-start (str o) w)))
                row
                col-widths))))))))


(defn coerce-to-pairs [o]
  (if (vector? o)
    (partition 2 o)
    o))

(defn short? [f]
  (re-find %r/^-[^-]$/ f))

(defn long? [f]
  (re-find %r/^--.*/ f))

(print-help )

(re-find %r"\r?\n" "\r\n")

(defn print-help [cmd-name doc command-pairs argnames flagpairs]
  (let [desc
        ]
    ))

(fn [a]
  (str (first (str:split %r"\r?\n" (:doc a "")))
    ))
