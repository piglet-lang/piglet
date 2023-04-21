(module express-test
  (:import [express :from "express"]
           [hiccup :from ::hiccup]))

(def port 3005)

(def app (express:default))

(def routes
  [[:get "/" (fn [req]
               {:status 200
                :headers {"content-type" "text/html"}
                :body (hiccup:html [:p "Hello, world"])})]])

(.get app "/"
      (fn [req res]
        (.send res (hiccup:html [:p "Hello, world"]))))


(println "Starting Express.js on port" port)
(.listen app port)
