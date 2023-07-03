(module pdp-client
  (:import [cbor :from "./cbor.mjs"]))

;; Walking skeleton for a Piglet Dev Protocol client
;;
;; Connect to ws://localhost:17017. Waits for CBOR-encoded messages with {"op"
;; "eval", "code" ...}, evaluates the code, and replies with {"op" "eval",
;; "result" result-str}

(def WebSocket (if (not= "undefined" (typeof js:WebSocket))
                 js:WebSocket
                 @(.resolve (await (js-import "ws")) "default")))

(def conn (WebSocket. "ws://127.0.0.1:17017"))

(set! (.-binaryType conn) "arraybuffer")

(defn completion-candidates [mod prefix]
  (filter (fn [n]
            (.startsWith n prefix))
    (map (fn [v] (.-name v))
      (ovals (.-vars mod)))))

(set!
  (.-onmessage conn)
  (fn ^:async on-message [msg]
    (let [msg (->pig (cbor:decode (.-data msg)))
          op (:op msg)
          code (:code msg)
          location (:location msg)
          module (:module msg)
          package (:package msg)
          var (:var msg)
          reply-to (:reply-to msg)
          reply (fn [answer]
                  (let [reply (cond-> {:op op}
                                reply-to
                                (assoc :to reply-to)
                                :->
                                (into answer))]
                    ;;(println '<- reply)
                    (.send conn (cbor:encode (->js reply)))))]
      (when (string? location)
        (.set_value (resolve '*current-location*) location))
      (when (string? module)
        (.set_value (resolve '*current-module*) (.ensure_module module-registry package module)))
      (when (string? package)
        (.set_value (resolve '*current-package*) (.ensure_package module-registry package)))
      (cond
        (= "resolve-meta" op)
        (do
          (println "Resolving" var "in" *current-module* ":" (resolve (symbol var)) " / " (meta (resolve (symbol var))))
          (let [var (resolve (symbol var))
                val @var]
            (reply {:result (print-str (meta (if (instance? Module val)
                                               val
                                               var)))})))

        (= "eval" op)
        (do
          (println code)
          (.then
            (.eval_string *compiler* code location (:start msg) (:line msg))
            (fn [val]
              (println '=> val)
              (reply {:result (print-str val)}))
            (fn [err]
              (js:console.log err)
              (reply {:result (print-str err)}))))

        (= "completion-candidates" op)
        (let [prefix (:prefix msg)]
          (cond
            ;; TODO (.includes prefix "://")
            (.includes prefix ":")
            (let [[alias suffix] (split ":" prefix)]
              (if-let [mod (find-module (symbol alias))]
                (reply {:candidates (map (fn [c] (str alias ":" c))
                                      (completion-candidates mod suffix))})
                (reply {:candidates []})))
            :else
            (reply {:candidates (concat
                                  (completion-candidates (find-module 'piglet:lang) prefix)
                                  (completion-candidates *current-module* prefix))})
            ))))))
