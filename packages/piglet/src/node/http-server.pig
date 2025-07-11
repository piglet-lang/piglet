(module node/http-server
  "Wrapper around node:http that encodes/decodes request/response as piglet dictionaries"
  (:import
    [str :from string]
    [fs :from "node:fs"]
    [http :from "node:http"]))

(defprotocol LifeCycle
  (start! [server])
  (stop! [server]))

(defn as-promise [v]
  (if (.-then v)
    v
    (js:Promise. (fn [res rej] (res v)))))

(defn create-server [handler opts]
  (specify!
    (http:createServer
      (fn [req res]
        (let [url (js:URL. (.-url req) "http://example.com") ;; js:URL does not like relative
              response (handler {:method (keyword (str:downcase (.-method req)))
                                 :path (.-pathname url)
                                 :query-params (into {} (.-searchParams url))
                                 :headers (into {}
                                            (map (fn [[k v]]
                                                   [(.toLowerCase k) v])
                                              (partition 2 (.-rawHeaders req))))})]
          (.then (as-promise response)
            (fn [response]
              ;; (println 'http-> (:status response) (:headers response))
              (.writeHead res (:status response) (->js (:headers response)))
              (if (instance? fs:ReadStream (:body response))
                (.pipe (:body response) res)
                (.end res (:body response))))
            (fn [error]
              (let [msg
                    (str "Error in request handler: " (.-message error)
                      "\n\n"
                      (.-stack error))]
                (println msg)
                (.writeHead res 500 #js {"Content-Type" "text/plain"})
                (.end res msg)))))))
    LifeCycle
    (start! [server]
      (.listen server (:port opts) (:host opts "0.0.0.0")))
    (stop! [server]
      (.close server))))

(comment
  (defn handler [req]
    {:status 200
     :content-type :json
     :body {:foo "bar"}})

  (defn json-body-mw [handler]
    (fn ^:async h [req]
      (let [res (await (handler req))]
        (if (= :json (:content-type res))
          (-> res
            (assoc-in [:headers "Content-Type"] "application/json")
            (update :body (comp js:JSON.stringify ->js)))
          res))))

  (def server (-> handler
                json-body-mw
                (create-server {:port 1234})))

  (start! server))
