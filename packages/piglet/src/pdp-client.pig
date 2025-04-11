(module pdp-client
  (:import
    piglet:cbor
    piglet:string))

;; Walking skeleton for a Piglet Dev Protocol client
;;
;; Connect to ws://localhost:17017. Waits for CBOR-encoded messages with {"op"
;; "eval", "code" ...}, evaluates the code, and replies with {"op" "eval",
;; "result" result-str}

(def WebSocket (if (undefined? js:WebSocket)
                 @(.resolve (await (js-import "ws")) "default")
                 js:WebSocket))

(defn completion-candidates [mod prefix]
  (filter (fn [n]
            (.startsWith n prefix))
    (map (fn [v] (.-name v))
      (vals mod))))

(defn on-message-fn [conn]
  (fn ^:async on-message [msg]
    (let [msg (cbor:decode (.-data msg))
          _ (println '<- msg)
          {:keys [op code location module package var reply-to]} msg
          reply (fn [answer]
                  (let [reply (cond-> {:op op}
                                reply-to
                                (assoc :to reply-to)
                                :->
                                (into answer))]
                    (println '-> reply)
                    (.send conn (cbor:encode reply))))]
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
            (and (string? prefix) (string:includes? prefix ":"))
            (let [[alias suffix] (string:split ":" prefix)]
              (if-let [mod (find-module (symbol alias))]
                (reply {:candidates (map (fn [c] (str alias ":" c))
                                      (completion-candidates mod suffix))})
                (reply {:candidates []})))
            :else
            (reply {:candidates (concat
                                  (completion-candidates (find-module 'piglet:lang) prefix)
                                  (completion-candidates *current-module* prefix))})))))))

(defn connect! [uri]
  (let [conn (WebSocket. "ws://127.0.0.1:17017")]

    (set! (.-onerror conn) (fn [{:keys [error]}]
                             (let [{:keys [code address port]} error]
                               (when (= "ECONNREFUSED" code)
                             (println "ERROR: Connection to PDP server at" (str "ws://" address ":" port) "failed. Is the server running?")
                             (when (not (undefined? js:process))
                               (js:process.exit -1))))))

    (set! (.-onmessage conn) (on-message-fn conn))

    (set! (.-binaryType conn) "arraybuffer")))

;; TODO: create a main function instead of a top-level call
(connect! "ws://127.0.0.1:17017")
