(module :pdp:pdp-client
  (:import [cbor :from "./cbor.mjs"]))

(def conn (js:WebSocket. "ws://localhost:17017"))

(set!
  (.-onmessage conn)
  (fn ^:async on-message [msg]
    (let [msg (cbor:decode (await (.arrayBuffer (.-data msg))))
          op (.-op msg)
          code (.-code msg)]
      (if (= op "eval")
        (.send conn
          (cbor:encode
            #js {"op" "eval"
            "result" (print-str (await (.eval_string *compiler* code)))}))))))
