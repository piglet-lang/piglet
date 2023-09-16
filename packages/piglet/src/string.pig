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
    (.replaceAll s (if (some #{"g"} (.-flags match))
                     match
                     (js:RegExp. match (str (.-flags match) "g")))
      replace)))

(defn starts-with? [s prefix]
  (when s
    (.startsWith s prefix)))

(defn ends-with? [s prefix]
  (when s
    (.endsWith s prefix)))

(defn includes? [s substring]
  (when s
    (.includes s substring)))

(defn trim [s]
  (when s
    (.trim s)))

;; separator first, for partial application
(defn join [sep strings]
  (.join (js:Array.from strings
           ;; Prevent the idx argument being passed to str
           (fn [s] (str s))) sep))

(defn split [sep string]
  (when string
    (.split string sep)))

(def split-kebab (partial split "-"))
(def split-snake (partial split "_"))
(def split-camel (comp
                   (partial map downcase)
                   (partial split %r/(?=[A-Z])/)))

(def join-kebab (partial join "-"))
(def join-snake (partial join "_"))
(def join-camel (comp
                  (partial join "")
                  (partial map capitalize)))

(defn join-dromedary [parts]
  (apply str
    (first parts)
    (map capitalize (rest parts))))

(def kebab->snake (comp join-snake split-kebab))
(def kebab->camel (comp join-camel split-kebab))
(def kebab->dromedary (comp join-dromedary split-kebab))

(def snake->kebab (comp join-kebab split-snake))
(def snake->camel (comp join-camel split-snake))
(def snake->dromedary (comp join-dromedary split-snake))

(def camel->kebab (comp join-kebab split-camel))
(def camel->snake (comp join-snake split-camel))
(defn camel->dromedary [s]
  (str (downcase (first s)) (subs s 1)))

(def dromedary->snake camel->snake)
(def dromedary->kebab camel->kebab)
(defn dromedary->camel [s]
  (str (upcase (first s)) (subs s 1)))

(comment
  (snake->kebab
    (camel->snake
      (dromedary->camel
        (kebab->dromedary "xxx-yyy-zzz")))))
