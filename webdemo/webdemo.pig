(module ::webdemo)

(js:console.log "hello, piglet!")
(def app-div (js:document.getElementById "app"))
(def header (js:document.createElement "h1"))

(defn add-child [container child]
  (.appendChild container child))

(add-child header (js:document.createTextNode "Hello from Piglet! 🐷"))
(add-child app-div header)
(def lst '(1 2 3))
