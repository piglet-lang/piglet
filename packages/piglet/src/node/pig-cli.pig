(module node/pig-cli
  "Implementation of the `pig` project management tool

  This is one of the two main entry points for piglet, the other being the
  `piglet` interpreter"
  (:import
    [parseargs :from cli/parseargs]
    [term :from cli/terminal]
    [fs :from "node:fs"]
    [NodeREPL :from "../../../../lib/piglet/node/NodeREPL.mjs"]))

(defn ^:async maybe-load-current-package []
  (when (fs:existsSync "package.pig")
    (await (load-package "."))))

(defn repl
  {:doc "Start a Piglet REPL"
   :async true}
  [opts]
  (when (:verbose opts)
    (set! *verbosity* (:verbose opts)))
  ;; Wait a tick so this module has finished loading, so we don't briefly show
  ;; a prompt with a current-module of node/pig-cli
  (js:setTimeout
    (fn ^:async []
      (await (maybe-load-current-package))
      (set! *current-module* (ensure-module (fqn *current-package*) "user"))
      (.start_readline (NodeREPL. *compiler* #js {})))
    0))

(defn
  pdp
  {:doc "Connect to Piglet Dev Protocol server (i.e. your editor)"
   :async true
   :flags ["--host,-h=<host>" {:doc "Hostname or IP address to connect to"
                               :default "127.0.0.1"}
           "--port, -p=<port>" {:doc "Port to connect on"
                                :default 17017}
           "--[no]-ssl" {:doc "Use SSL (wss protocol instead of ws)"}]}
  [opts]
  (await (require 'pdp-client))
  (await (maybe-load-current-package))
  (let [url (str (if (:ssl opts) "wss" "ws") "://" (:host opts) ":" (:port opts))]
    (println (term:fg :cyan "Connecting to PDP on") (term:fg :yellow url))
    ((resolve 'piglet:pdp-client:connect!) url)))

(defn web
  {:doc "Start dev-server for web-based projects"
   :async true
   :flags ["--port, -p=<port>" {:doc "Port to start http server on"
                                :default 1234}]}
  [opts]
  (await (require 'node/dev-server))
  ((resolve 'piglet:node/dev-server:main) opts))

(defn aot
  {:doc "AOT compile the given module and its dependencies"
   :async true}
  [{:keys [module] :as opts}]
  (await (maybe-load-current-package))
  (await (compile (read-string module))))

(defn run
  ^:async
   [{:keys [module] :as opts}]
  (await (maybe-load-current-package))
  (await (require (read-string module)))
  )

(def commands
  ["repl" #'repl
   "run <module>" #'run
   "pdp" #'pdp
   "web" #'web
   "aot <module>" #'aot])

(def flags
  ["--verbose, -v" "Increase verbosity"])

(parseargs:dispatch
  {:name "pig"
   :doc "Piglet's project tool"
   :commands commands
   :flags flags
   :middleware [(fn [cmd]
                  (fn [opts]
                    (when (:verbose opts)
                      (set! *verbosity* (:verbose opts)))
                    (cmd opts)))]}
  (drop 2 js:process.argv))
