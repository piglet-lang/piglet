(module node/pig-cli
  "Implementation of the `pig` project management tool

  This is one of the two main entry points for piglet, the other being the
  `piglet` interpreter"
  (:import
    [parseargs :from cli/parseargs]
    [term :from cli/terminal]
    [NodeREPL :from "../../../../lib/piglet/node/NodeREPL.mjs"]))

(defn repl
  "Start a Piglet REPL"
  [opts]
  (when (:verbose opts)
    (set! *verbosity* (:verbose opts)))
  (.start (NodeREPL. *compiler* #js {})))

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

(def commands
  ["repl" #'repl
   "pdp" #'pdp
   "web" #'web])

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
