(module cli-test
  (:import
    [cli :from piglet:cli/port]
    [str :from piglet:string]))

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
  (drop 3 js:process.argv)
  #_ ["list"])

;; (defn x
;;   ([])
;;   ([a] (loop [a a])))

;; (fn []
;;   (fn []
;;     (recur)))


;; (fn []
;;   (let [reply
;;         (fn [answer]
;;           (let [x 1]
;;             (println 1)
;;             (println 1)
;;             ))]
;;     ))
