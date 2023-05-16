(module :pdp:pdp-client
  (:import [cbor :from "./cbor.mjs"]))

;; Walking skeleton for a Piglet Dev Protocol client
;;
;; Connect to ws://localhost:17017. Waits for CBOR-encoded messages with {"op"
;; "eval", "code" ...}, evaluates the code, and replies with {"op" "eval",
;; "result" result-str}

(println (typeof js:WebSocket))
(println "XXX" (!= "undefined" (typeof js:WebSocket)))

(def WebSocket (if (!= "undefined" (typeof js:WebSocket))
                 js:WebSocket
                 @(.resolve (await (js-import "ws")) "default")))

(def conn (WebSocket. "ws://localhost:17017"))

(set! (.-binaryType conn) "arraybuffer")

(set!
  (.-onmessage conn)
  (fn ^:async on-message [msg]
    (println)
    (let [msg (cbor:decode (.-data msg))
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
