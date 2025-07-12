(module cli/parseargs
  "CLI argument handling with subcommand support and nice help text.

  Port from Clojure's lambdaisland/cli, with improvements."
  (:import
    [str :from string]
    [term :from cli/terminal]))

(def *opts*
  "Gets bound during command dispatch, so arbitrary code can access the final options map"
  nil)

(defn transpose
  "Generic matrix transposition"
  [m]
  (apply mapv vector m))

(defn print-table
  ([rows]
    (print-table rows {}))
  ([rows {:keys [pad] :or {pad 2}}]
    (when (seq rows)
      (let [col-widths (map #(apply max (map (comp count str) %)) (transpose rows))]
        (doseq [row rows]
          (println
            (str:join ""
              (map (fn [o w]
                     (str (str:join (repeat 2 " ")) (str:pad-end (str o) w)))
                row
                col-widths))))))))

(defn coerce-to-pairs [o]
  (if (vector? o)
    (partition 2 o)
    o))

(defn short? [f]
  (re-find #"^-[^-]$" f))

(defn long? [f]
  (re-find #"^--.*" f))

(defn print-help [cmd-name doc command-pairs argnames flagpairs]
  (let [desc #(str (first (str:split #"\n" (:doc % "")))
                (when-let [d (:default %)] (str " (default " (print-str d) ")")))
        doc-lines (when-not (str:blank? doc)
                    (str:split #"\n" doc))]
    (println (term:fg :green "COMMAND"))
    (println " " cmd-name
      (if doc-lines
        (str " ——  " (first doc-lines))
        ""))
    (println)

    (println (term:fg :green "USAGE"))
    (println (str "  " cmd-name
               (when (seq argnames)
                 (str:join (for [n argnames]
                             (str " <" (name n) ">"))))
               (str:join (for [[_ {:keys [flags argdoc]}] flagpairs]
                           (str " [" (str:join " | " flags) argdoc "]")))
               (when (seq command-pairs)
                 (str " ["
                   (str:join " | " (map first command-pairs))
                   "]"))
               " [<args>...]"))
    (when-let [doc (rest doc-lines)]
      (println (term:fg :green "\nDESCRIPTION"))
      (println " " (str:join "\n  " (map str:trim (drop-while #(str:blank? %) doc)))))
    (when (seq flagpairs)
      (let [has-short? (some short? (mapcat (comp :flags second) flagpairs))
            has-long?  (some long? (mapcat (comp :flags second) flagpairs))]
        (println (term:fg :green "\nFLAGS"))
        (print-table
          (apply
            concat
            (for [[_ {:keys [flags argdoc doc required] :as flagopts}] flagpairs]
              (let [short (some short? flags)
                    long (some long? flags)]
                (into [[(str (cond
                               short
                               (str (term:fg :cyan short) ", ")
                               has-short?
                               "    "
                               :else
                               "")
                          (term:fg :cyan long)
                          argdoc)
                        (desc flagopts)
                        (if required "(required)" "")]]
                  (map (fn [l]
                         ["" l ""]))
                  (rest (str:split #"\n" (or doc ""))))))))))
    (when (seq command-pairs)
      (println (term:fg :green "\nSUBCOMMANDS"))
      (print-table
        (for [[cmd cmdopts] command-pairs]
          [(str (term:fg :cyan cmd) (if (:commands cmdopts)
                                      (str " <" (str:join "|" (map first (:commands cmdopts))) ">")
                                      (:argdoc cmdopts)))
           (desc cmdopts)])))))

(defn parse-error! [& msg]
  (throw (js:Error. (str:join " " msg))))

(defn prepend-middleware* [opts mw]
  (update opts ::middleware #(into (vec mw) %)))

(defn append-middleware* [opts mw]
  (update opts ::middleware (fnil into []) mw))

(defn append-middleware [opts {mw :middleware}]
  (append-middleware*
   opts
   (if (or (nil? mw) (sequential? mw)) mw [mw])))

(defn call-handler [handler opts & args]
  (binding [*opts* opts]
    (apply handler opts args)))

(defn assoc-flag
  ([opts {:keys [middleware handler] :as flagspec} & args]
   (let [mw (cond
              (nil? middleware)
              []
              (sequential? middleware)
              (vec middleware)
              :else
              [middleware])]
     (prepend-middleware*
      opts
      (conj mw
            (fn [cmd]
              (fn [opts]
                (cmd
                 (if handler
                   (apply call-handler handler opts args)
                   (-> opts
                       (assoc
                         (:key flagspec)
                         (cond
                           (= 0 (count args))
                           (if (has-key? flagspec :value)
                             (:value flagspec)
                             ((fnil inc 0) (get opts (:key flagspec))))
                           (= 1 (count args))
                           (if (:coll? flagspec)
                             ((fnil conj []) (get opts (:key flagspec)) (first args))
                             (first args))
                           :else
                           (if (:coll? flagspec)
                             ((fnil into []) (get opts (:key flagspec)) args)
                             (vec args))))
                       (assoc-in [::sources (:key flagspec)] (str (:flag flagspec) " command line flag"))))))))))))

(defn default-parse [s]
  (cond
    (re-find #"^-?\d+$" s)
    (parse-long s)
    (re-find #"^-?\d+\.\d+$" s)
    (parse-double s)
    :else
    s))

(defn handle-flag [{:keys [flagmap strict?] :as cmdspec} flag cli-args args flags]
  (reduce
   (fn [[cli-args args flags] f]
     (let [[f arg] (str:split #"=" f)]
       (if-let [{:keys [argcnt flagstr value handler middleware parse] :as flagspec
                 :or {parse default-parse}} (get flagmap f)]
         (cond
           (or (nil? argcnt)
               (= 0 argcnt))
           (if (:boolean? flagspec)
             [cli-args args (assoc-flag flags flagspec value)] ;; --[no-]... style flag handlers get a bool passed in
             [cli-args args (assoc-flag flags flagspec)])
           (= 1 argcnt)
           (cond
             arg
             [cli-args args (assoc-flag flags flagspec (parse arg))]
             (first cli-args)
             [(rest cli-args) args (assoc-flag flags flagspec (parse (first cli-args)))]
             :else
             (parse-error! flagstr "expects an argument, but no more positional arguments available."))
           :else
           [(drop argcnt cli-args) args (assoc-flag flags flagspec (map parse (take argcnt cli-args)))])
         (if strict?
           (parse-error! "Unknown flag:" f)
           [cli-args args
            (assoc-flag
             flags
             {:key (keyword (str:replace f #"^-+" ""))
              :handler (fn [opts]
                         (update opts
                           (keyword (str:replace f #"^-+" ""))
                           #(or arg ((fnil inc 0) %))))} )]))))
   [cli-args args flags]
   (if (re-find #"^-\w+" flag)
     (map #(str "-" %) (rest flag))
     [flag])))

(def args-re #" ([A-Z][A-Z_-]*)|[= ]<([^>]+)>")
(def flag-re #"^(--?)(\[no-\])?(.+)$")

(defn parse-arg-names [str]
  [(str:split #",\s*" (str:replace str args-re ""))
   (str:join (map first (re-seq args-re str)))
   (mapv (fn [[_ u l]] (keyword (str:downcase (or u l)))) (re-seq args-re str))])

(defn to-cmdspec [?var]
  (cond
    (var? ?var)
    (if (fn? @?var)
      (assoc (meta ?var) :command ?var)
      (merge (meta ?var) @?var))

    (fn? ?var)
    {:command ?var}

    (var? (:command ?var))
    (merge (meta (:command ?var)) ?var)

    :else
    ?var))

(defn prepare-cmdpairs [commands]
  (let [m (if (vector? commands) (partition 2 commands) commands)]
    (map (fn [[k v]]
           (let [v (to-cmdspec v)
                 [[cmd] doc argnames] (parse-arg-names k)]
             [cmd (assoc v :argdoc doc :argnames argnames)]))
      m)))

(defn cmd->flags [cmdspec args]
  (if (seq args)
    (when-let [cmds (:commands cmdspec)]
      (cmd->flags (get (into {} (prepare-cmdpairs (:commands cmdspec)))
                       (first args))
                  (rest args)))
    (:flags cmdspec)))

(defn parse-flagstr [flagstr flagopts]
  (let [;; support "--foo=<hello>" and "--foo HELLO"
        [flags argdoc argnames] (parse-arg-names flagstr)
        argcnt                  (count argnames)
        ;; e.g. "-i,--input, --[no-]foo ARG"
        flagstrs                (map #(re-find flag-re %) flags)
        flag-key                (keyword (or (some (fn [[_ dash no flag]]
                                                     (when (= "--" dash) flag))
                                               flagstrs)
                                           (last (first flagstrs))))]
    (merge {:flagstr flagstr
            :argdoc  argdoc
            :flags   flags
            :args    argnames
            :key     flag-key
            :argcnt  argcnt}
           flagopts)))

(defn prepare-flagpairs [flagstrs]
  (when (seq flagstrs)
    (map (fn [[flagstr flagopts]]
           (let [flagopts (if (var? flagopts)
                            {:doc (:doc (meta flagopts))
                             :handler flagopts}
                            flagopts)]
             [flagstr (parse-flagstr flagstr (if (string? flagopts) {:doc flagopts} flagopts))]))
         (coerce-to-pairs flagstrs))))

(defn build-flagmap-entries [[flagstr flagopts]]
  (let [{:keys [args key argcnt flags] :as parsed-flagstr} flagopts
        flags                                              (map #(re-find flag-re %) flags)]
    (for [[_ dash no flag] flags
          negative?        (if no [true false] [false])]
      (cond-> {:flag   (str dash (if negative? "no-") flag)
               :key    key
               :argcnt argcnt}
        (= dash "-")
        (assoc :short? true)
        (seq args)
        (assoc :args args)
        no
        (assoc :value (not negative?)
          :boolean? true)
        :->
        (merge flagopts)))))

(defn parse-flagstrs [flagpairs]
  (into {"-h" {:key :help :value true}
         "--help" {:key :help :value true}}
    (map (juxt (fn [o]
                 (:flag o)) identity)
      (mapcat build-flagmap-entries
        flagpairs))))

(defn add-defaults [init-opts flagpairs]
  (reduce (fn [opts flagspec]
            (if (some? (get opts (:key flagspec)))
              opts
              (if-let [d (:default flagspec)]
                (let [d (if (and (string? d) (:parse flagspec))
                          ((:parse flagspec default-parse) d)
                          d)]
                  (if-let [h (:handler flagspec)]
                    (binding [*opts* opts] (h opts d))
                    (-> opts
                        (assoc (:key flagspec) d)
                        (assoc-in [::sources (:key flagspec)] (str (:flagstr flagspec) " (default value)")))))
                opts)))
          init-opts
          (map second flagpairs)))

(defn add-processed-flags
  "We process flag information for easier use, this results in
  `:flagpairs` (ordered sequence of pairs, mainly used in printing help
  information), and `:flagmap` (for easy lookup), added to the `cmdspec`. As we
  process arguments we may need to add additional flags, based on the current
  subcommand. This function is used both for the top-level as for subcommand
  handling of flags."
  [cmdspec extra-flags]
  (let [flagpairs (prepare-flagpairs extra-flags)
        flagmap   (parse-flagstrs flagpairs)]
    (-> cmdspec
      (update :flagpairs (fn [fp]
                           (into (vec fp)
                             ;; This prevents duplicates. Yes, this is not pretty. I'm very sorry.
                             (remove #((into #{} (map first) fp) (first %)))
                             flagpairs)))
      (update :flagmap merge flagmap))))

(defn split-flags
  "Main processing loop, go over raw arguments, split into positional and flags,
  building up an argument vector, and flag/options map."
  [cmdspec cli-args opts]
  (loop [cmdspec          cmdspec
         [arg & cli-args] cli-args
         args             []
         seen-prefixes    #{}
         opts             opts]
    ;; Handle additional flags by nested commands
    (let [extra-flags (when-not (seen-prefixes args)
                        (cmd->flags cmdspec args))
          opts        (add-defaults opts (prepare-flagpairs extra-flags))
          cmdspec     (add-processed-flags cmdspec extra-flags)]
      (cond
        (nil? arg)
        [cmdspec args opts]

        (= "--" arg)
        [cmdspec (into args cli-args) opts]

        (and (= "-" (first arg))
          (not= 1 (count arg))) ; single dash is considered a positional argument
        (let [[cli-args args opts] (handle-flag cmdspec arg cli-args args opts)]
          (recur (dissoc cmdspec :flags) cli-args args (conj seen-prefixes args) opts))

        :else
        (recur
          (dissoc cmdspec :flags)
          cli-args
          (conj args (str:replace arg #"^\\(.)" (fn [[_ o]] o))) ; remove initial backslash, allows args to be escaped
          (conj seen-prefixes args)
          opts)))))

(defn missing-flags
  "Return a set of required flags in `flagmap` not present in `opts`, or `nil` if
  all required flags are present."
  [flagmap opts]
  (let [required    (->> flagmap vals (filter (comp true? :required)) (map :key) set)
        received    (->> opts keys set)
        missing (map (fn [key]
                       (->> flagmap vals (map #(vector (:key %) (:flags %))) (into {}) key))
                  (remove received required))]
    (seq missing)))

(defn help-mw [{:keys [name doc argnames flagpairs]
                :or   {name "cli"}}]
  (fn [cmd]
    (fn [opts]
      (if (:help opts)
        (print-help name doc [] argnames flagpairs)
        (cmd opts)))))

(defn missing-flags-mw [{:keys [flagmap]}]
  (fn [cmd]
    (fn [opts]
      (if-let [missing (missing-flags flagmap opts)]
        (parse-error! "Missing required flags:" (->> missing (map #(str:join " " %)) (str:join ", ")))
        (cmd opts)))))

(defn bind-opts-mw []
  (fn [cmd]
    (fn [opts]
      (binding [*opts* opts]
        (cmd opts)))))

(defn dispatch
  "Main entry point"
  ([{:keys [flags init] :as cmdspec} cli-args]
    (let [init                     (if (or (fn? init) (var? init)) (init) init)
          init                     (assoc init ::sources (into {} (map (fn [k] [k "Initial context"])) (keys init)))
          [cmdspec pos-args flags] (split-flags cmdspec cli-args init)
          flagpairs                (get cmdspec :flagpairs)]
      (dispatch cmdspec pos-args flags)))
  ;; Note: this three-arg version of dispatch* is considered private, it's used
  ;; for internal recursion on subcommands.
  ([{:keys        [commands doc argnames command flags flagpairs flagmap middleware]
     :as          cmdspec
     program-name :name
     :or          {program-name "cli"}}
    pos-args
    opts]
    (let [opts (prepend-middleware* opts (if (fn? middleware)
                                           [middleware]
                                           middleware))]
      (cond
        command
        (let [middleware (into [(bind-opts-mw)
                                (missing-flags-mw cmdspec)
                                (help-mw cmdspec)]
                           (::middleware opts))
              opts (-> opts
                     (dissoc ::middleware)
                     (update ::argv (fnil into []) pos-args)
                     (merge (zipmap argnames pos-args)))]
          (binding [*opts* opts]
            ((reduce #(%2 %1) command middleware) opts)))

        commands
        (let [[cmd & pos-args] pos-args
              pos-args         (vec pos-args)
              cmd              (when cmd (first (str:split #"[ =]" cmd)))
              opts             (if cmd (update opts ::command (fnil conj []) cmd) opts)
              command-pairs    (prepare-cmdpairs commands)
              command-map      (update-keys (into {} command-pairs)
                                 #(first (str:split #"[ =]" %)))
              command-match    (get command-map cmd)
              argnames         (:argnames command-match)
              arg-count        (count argnames)]
          (cond
            (and command-match
              (<= arg-count (count pos-args)))
            (dispatch
              (-> cmdspec
                (dissoc :command :commands :middleware)
                (merge command-match)
                (dissoc :argnames)
                (assoc :name (str program-name " " cmd)))
              (drop arg-count pos-args)
              (-> opts
                (update ::argv (fnil into []) (take arg-count pos-args))
                (merge (when-let [i (:init cmdspec)]
                         (if (or (fn? i) (var? i)) (i) i)))
                (merge (zipmap argnames pos-args))
                (update ::sources merge (zipmap argnames (map (fn [idx] (str "positional command line argument idx=" idx))
                                                           (range (count pos-args)))))))

            (or (nil? command-match)
              (:help opts)
              (< (count pos-args) arg-count))
            (do
              (cond
                (and cmd (nil? command-match))
                (println "No matching command found:" cmd "\n")
                (< (count pos-args) arg-count)
                (println "Positional arguments missing:"
                  (->> argnames
                    (drop (count pos-args))
                    (map #(str "<" (name %) ">"))
                    (str:join " "))
                  "\n"))
              (if cmd
                (print-help (str program-name (when-not (nil? command-match)
                                                (str " " cmd)))
                  (if command-match
                    (:doc command-match)
                    doc)
                  (for [[k v] (if command-match
                                (-> command-match :commands prepare-cmdpairs)
                                command-pairs)]
                    [k (if (:commands v)
                         (update v :commands prepare-cmdpairs)
                         v)])
                  argnames
                  flagpairs)
                (print-help program-name
                  doc
                  (for [[k v] command-pairs]
                    [k (if (:commands v)
                         (update v :commands prepare-cmdpairs)
                         v)])
                  argnames
                  flagpairs)))

            :else
            (parse-error! "Expected either :command or :commands key in" cmdspec)))))))


;;;;
