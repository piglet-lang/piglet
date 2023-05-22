(module :webdemo:webdemo
  (:import
    [_ :from piglet:pdp-client]
    [dom :from piglet:dom]))

(println "hello, piglet!")
(def app-div (dom:id->el "app"))
(def header (dom:el "h1"))

(conj! header (dom:text-node "Hello from Piglet! 🐷"))
(conj! app-div header)

(js:document.getElementById "app")
