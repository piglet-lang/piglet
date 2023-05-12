(module :webdemo:webdemo
  (:import
    [_ :from :pdp:pdp-client]
    [dom :from :dom:dom]
    [solid :from "solid-js"]
    [solid-web :from "solid-js/web"]))

(println "hello, piglet!")
(def app-div (dom:id->el "app"))
(def header (dom:el "h1"))

(conj! header (dom:text-node "Hello from Piglet! 🐷"))
(conj! app-div header)

;; (def x 3)

;; (def m
     ;;   (solid:createMemo (fn [] x)))

;; (let [[count count!] (solid:createSignal 0)]
;;   (def count count)
;;   (def count! count!))


;; (count! 3)

;; (solid-web:template "<div>")
;; (solid-web:untrack (fn [] 1))
