(module :webdemo:webdemo
  (:import [_ :from :pdp:pdp-client]))

(js:console.log "hello, piglet!")
(def app-div (.getElementById js:document "app"))
(def header (.createElement js:document "h1"))

(defn add-child [container child]
  (.appendChild container child))

(add-child header (.createTextNode js:document "Hello from Piglet! 🐷"))
(add-child app-div header)
(def lst '(1 2 3))
