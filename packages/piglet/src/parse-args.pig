(module parse-args
  (:import string))

(def
  commands
  {:commands [["list" "List the things"
               {:commands [""]}]]
   }
  )

(def argspec
  {:name "bake"
   :prelude "Command to do various things."
   :coda "For more information check the README."
   :commands
   [["-v, --verbose" "Increase verbosity"
     {:type :counter}]
    ["-o, --output <file>" "File to write to"]
    ["-i, --input=<file>" "File to read from"]
    ["-[no]-dry-run" "Enable/disable dry-run"]

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
    (when coda (str  coda "\n"))))

(println
  (render argspec))

(defn parse [argspec argv]
  {:argspec argspec
   :argv-remaining argv})
