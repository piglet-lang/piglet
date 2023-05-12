(module :pdp:pdp-client
  (:import [cbor :from "cbor"]))

;; Walking skeleton for a Piglet Dev Protocol client
;;
;; Connect to ws://localhost:17017. Waits for CBOR-encoded messages with {"op"
;; "eval", "code" ...}, evaluates the code, and replies with {"op" "eval",
;; "result" result-str}

(def WebSocket (if js:WebSocket
                 js:WebSocket
                 @(.resolve (await (js-import "ws")) "default")))

(def conn (js:WebSocket. "ws://localhost:17017"))

(set!
  (.-onmessage conn)
  (fn ^:async on-message [msg]
    (let [msg (cbor:decode (await (.arrayBuffer (.-data msg))))
          op (.-op msg)
          code (.-code msg)]
      (when (= op "eval")
        (println code)
        (.then
          (.eval_string *compiler* code)
          (fn [val]
            (println '=> val)
            (.send conn
              (cbor:encode
                #js {"op" "eval"
                     "result" (print-str val)})))
          (fn [err]
            (js:console.log err)
            (.send conn
              (cbor:encode
                #js {"op" "eval"
                     "result" (print-str err)}))))))))
