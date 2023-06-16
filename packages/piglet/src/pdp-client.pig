(module pdp-client
  (:import [cbor :from "./cbor.mjs"]))

;; Walking skeleton for a Piglet Dev Protocol client
;;
;; Connect to ws://localhost:17017. Waits for CBOR-encoded messages with {"op"
;; "eval", "code" ...}, evaluates the code, and replies with {"op" "eval",
;; "result" result-str}

(def WebSocket (if (!= "undefined" (typeof js:WebSocket))
                 js:WebSocket
                 @(.resolve (await (js-import "ws")) "default")))

(def conn (WebSocket. "ws://127.0.0.1:17017"))

(set! (.-binaryType conn) "arraybuffer")

(set!
  (.-onmessage conn)
  (fn ^:async on-message [msg]
    (println)
    (let [msg (cbor:decode (.-data msg))
          op (.-op msg)
          code (.-code msg)
          location (.-location msg)
          module (.-module msg)
          package (.-package msg)
          var (.-var msg)]
      (println msg)
      (when location
        (.set_value (resolve '*current-location*) location))
      (when module
        (.set_value (resolve '*current-module*) (.ensure_module module-registry package module)))
      (when package
        (.set_value (resolve '*current-package*) (.ensure_package module-registry package)))
      (cond
        (= "resolve-meta" op)
        (do
          (println "Resolving" var "in" *current-module* ":" (resolve (symbol var)) " / " (meta (resolve (symbol var))))
          (.send conn (cbor:encode #js {"op" "resolve-meta"
                                        "to" (oget msg "reply-to")
                                        "result" (print-str (meta (resolve (symbol var))))})))

        (= "eval" op)
        (do
          (println code)
          (.then
            (.eval_string *compiler* code location (.-start msg) (.-line msg))
            (fn [val]
              (println '=> val)
              (.send conn
                (cbor:encode
                  #js {"op" "eval"
                       "to" (oget msg "reply-to")
                       "result" (print-str val)})))
            (fn [err]
              (js:console.log err)
              (.send conn
                (cbor:encode
                  #js {"op" "eval"
                       "to" (oget msg "reply-to")
                       "result" (print-str err)})))))))))
