(module :piglet:nrepl
  (:import [bencode :from "bencode"]
           [net :from "node:net"]))

(def sessions {})

(defn pig->js [o]
  (cond
    (keyword? o)
    (name o)

    (symbol? o)
    (-repr o)

    (qname? o)
    (.-fqn o)

    (prefix-name? o)
    (-repr o)

    (dict? o)
    (reduce (fn [acc [k v]]
              (conj! acc [(pig->js k) (pig->js v)]))
            (js:Object) o)

    (sequential? o)
    (js:Array.from o pig->js)

    :else o))

(defn js-obj [& kvs]
  (reduce (fn [o [k v]]
            (conj! o [(name k) v]))
          (js:Object)
          (partition 2 kvs)))

(defn bencode [data]
  ((.-encode bencode:default) (pig->js data)))

(defn bdecode [data]
  ((.-decode bencode:default) data "utf-8"))

(defn response-for [old-msg msg]
  (js:Object.assign
   (js-obj :id (.-id old-msg) :session (.-session old-msg))
   msg))

(defn send-msg [conn msg]
  (println '<- msg)
  (.write conn (bencode msg)))

(defn op-clone [conn msg]
  (let [id (str (inc (count sessions)))]
    (.set_value (resolve 'nrepl:nrepl:sessions) (assoc sessions id {}))
    (send-msg conn (response-for msg (js-obj "new-session" id "status" ["done"])))))

(defn op-describe [conn msg]
  (send-msg
   conn
   (response-for
    msg
    (js-obj "status" ["done"]
            "aux" {}
            "ops" {"clone" {} "describe" {} "eval" {}}))))

(defn ^:async op-eval [conn msg]
  (let [code (.-code msg)
        form (read-string code)
        result-p (eval form)
        result (await result-p)]
    (send-msg
     conn
     (response-for
      msg
      (js-obj "ns" (-repr *current-module*)
              "value" (print-str result))))
    (send-msg
     conn
     (response-for
      msg
      (js-obj "status" ["done"])))))

(defn handle-data [conn data]
  (let [msg (bdecode data)
        op (when msg (.-op msg))]
    (println '-> msg)
    (cond
      (= op "clone") (op-clone conn msg)
      (= op "describe") (op-describe conn msg)
      (= op "eval") (op-eval conn msg))))

(defn handle-connection [conn]
  (println "New connection from" (.-remoteAddress conn) (.-remotePort conn))
  (.on conn "data" (fn [data] (handle-data conn data))))

(defn start! [port]
  (let [server (net:createServer)]
    (.on server "connection" handle-connection)
    (.listen server port (fn [s] (println "Server listenining on" (.address server))))))
