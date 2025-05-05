(module cli-test
  (:import [cli :from piglet:cli/port]))

(defn list-cmd
  "List things"
  [opts]
  (prn opts))

(def commands
  ["list" #'list-cmd])

(def flags
  ["--flag ARG" "Do a thing"])

(cli:dispatch
  {:name "cli-test"
   :commands commands
   :flags flags}
  ["--help"])

(defn x
  ([])
  ([a] (loop [a a])))
