(module express-test
  (:import
    hiccup
    [chalk :from "chalk"]
    [express :from "express"]))

(def port 3005)

(println express)
(println express:default)

(def app (express:default))

(def routes
  [[:get "/" (fn [req]
               {:status 200
                :headers {"content-type" "text/html"}
                :body (hiccup:html [:p "Hello, world"])})]])

(.get app "/"
      (fn [req res]
        (.send res (hiccup:html [:p "Hello, world"]))))


(println (.blue chalk:default "Starting Express.js on port") (.red chalk:default port))
(.listen app port)
