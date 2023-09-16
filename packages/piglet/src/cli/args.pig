(module cli/args
  "CLI-style argument rendering and parsing"
  (:import string))

(defn render-lines [lines]
  (string:join ""
    (map (fn [l] (str l "\n")) lines)))

(defn indent-lines [lines indent]
  (map (fn [l] (str (.padStart "" indent) l)) lines))

(defn align-columns [rows]
  (let [widths (map (fn [col] (apply max (map count col)))
                 (transpose rows))]
    (for [row rows]
      (string:join " "
        (map (fn [v w]
               (.padEnd v w)) row widths)))))

(defn render-tree [tree]
  (->
    (for [[cmd doc & more] tree
          :when (and (string? cmd) (string? doc))]
      [cmd doc])
    align-columns
    (indent-lines 2)
    render-lines))

(defn render [{:keys [name prelude coda commands]}]
  (str "Usage: " name " [options...] [args...]\n"
    (when prelude (str prelude "\n"))
    (render-tree commands)
    (when coda (str  coda "\n"))
    (foo 1 2 3)))



(def argspec
  {:name "bake"
   :prelude "Command to do various things."
   :coda "For more information check the README."
   :commands
   [["-v, --verbose" "Increase verbosity"
     {:type :counter}]
    ["-o, --output <file>" "File to write to"]
    ["-i, --input=<file>" "File to read from"]
    ["--[no]-dry-run" "Enable/disable dry-run"]

    ["files" "Operate on files"
     {:prelude "These commands do various things on files."}
     ["create <file>" "Create a file"
      {::command :create-file}]
     ["delete <file>" "delete a file"
      ["-f" "Force delete"]
      {::command :delete-file}]
     [:section "These are API commands"
      ["post" "Do a POST"]
      ["get" "Do a GET"]]]

    ["docs" "Do stuff with docs"]]})

(println (render argspec))

(defn normalize-command [])

(defn normalize-tree [tree]
  (loop [[entry & es] tree
         result {}]
    (if (nil? entry)
      result
      (let [[command doc & children] entry
            args (map second (re-seq %r/<([^>]*)>/ command))
            command (string:trim (string:replace command %r/<[^>]*>|=/ ""))
            commands (string:split %r"\s*,\s*" command)
            flag? (string:starts-with? command "-")]
        (recur
          es
          (reduce (fn [acc cmd]
                    (as-> {:name
                           (if flag?
                             (some (fn [c]
                                     (when (string:starts-with? c "--")
                                       (keyword (string:replace (string:subs c 2)
                                                  %r/^\[no\]-/ ""))))
                               commands)
                             cmd)
                           :doc doc} $
                      (if (seq args)
                        (assoc $ :args (map keyword args))
                        $)
                      (reduce (fn [$ c]
                                (if (dict? c)
                                  (update $ :data c)
                                  (update $ :subtree (fnil conj []) c)))
                        $ children)
                      (assoc acc cmd $)))
            result
            commands))))))

(normalize-tree (:commands argspec))

(defn handle-next-token [{:keys [argspec current-tree remaining] :as context}]
  (let [[token & remaining] remaining]
    ))

(defn parse [argspec argv]
  {:argspec argspec
   :current-tree (:commands argspec)
   :remaining argv})

(parse argspec ["files" "-v" "delete" "--output" "outfile" "-f" "more" "--" "output"])
