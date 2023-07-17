(module string)

(defn upcase [s]
  (when s
    (.toUpperCase (str s))))

(defn downcase [s]
  (when s
    (.toLowerCase (str s))))

(defn subs [s start end]
  (when s
    (if (undefined? end)
      (.slice (str s) start)
      (.slice (str s) start end))))

(defn capitalize [s]
  (when s
    (let [s (str s)]
      (str (upcase (first s)) (downcase (subs s 1))))))

(defn replace [s match replace]
  (when s
    (.replaceAll s match replace)))
