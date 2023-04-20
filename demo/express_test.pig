(module express-test
  (:import [express :from "express"]
           [hiccup :from ::hiccup]))

(def port 3005)

(def app (express:default))

(.get app "/"
      (fn [req res]
        (.send res (hiccup:html [:p "Hello, world"]))))


(println "Starting Express.js on port" port)
(.listen app port)
