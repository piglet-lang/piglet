(module node/http-server
  (:import
    [http :from "node:http"]))

(defprotocol LifeCycle
  (start! [server])
  (stop! [server]))

(defn create-server [handler opts]
  (specify!
    (http:createServer
      (fn ^:async x [req res]
        (let [response (await (handler {:method (.-method req)
                                        :url (.-url req)
                                        :headers (into {}
                                                   (map (fn [[k v]]
                                                          [(.toLowerCase k) v])
                                                     (partition 2 (.-rawHeaders req))))}))]
          (.writeHead res (:status response) (->js (:headers response)))
          (.end res (:body response)))))
    LifeCycle
    (start! [server]
      (.listen server (:port opts) (:host opts "localhost")))
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
            (update :body (comp js:JSON.stringify ->js)))))))

  (def server (-> handler
                json-body-mw
                (create-server {:port 1234})))

  (start! server))
