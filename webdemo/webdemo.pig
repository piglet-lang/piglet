(module :webdemo:webdemo
  (:import
    [_ :from :pdp:pdp-client]
    [dom :from :dom:dom]))

(println "hello, piglet!")
(def app-div (dom:id->el "app"))
(def header (dom:el "h1"))

(conj! header (dom:text-node "Hello from Piglet! 🐷"))
(conj! app-div header)
