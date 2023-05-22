(module :webdemo:solid-demo
  (:import
    [_ :from piglet:pdp-client]
    [dom :from piglet:dom]
    [solid :from "solid-js"]
    [solid-web :from "solid-js/web"]))

(defn signal [init]
  (let [[getter setter] (solid:createSignal init)]
    (specify! setter
      Derefable
      (deref [_] (getter))
      Swappable
      (-swap! [_ f args]
        (setter (apply f (getter) args))))
    setter))

(defn memo [f]
  (let [m (solid:createMemo f nil #js {:equals =})]
    (specify! m
      Derefable
      (deref [_] (m)))
    m))

(defmacro reaction [& body]
  (list 'memo (cons 'fn (cons [] body))))

(defn template [str]
  (let [tmpl (dom:el "template")]
    (set! (.-innerHTML tmpl) str)
    (fn []
      (.-firstChild (.-content (.cloneNode tmpl true))))))

(defn Counter []
  (let [counter (signal 0)
        square (reaction (* @counter @counter))
        tmpl (template "<div><h1>Hello from Piglet! 🐷</h1>
<p>Count: <span id=\"count\"></span></p>
<p>Square: <span id=\"square\"></span></p>
</div>")]
    (js:setInterval (fn [] (swap! counter inc)) 1000)
    (fn []
      (let [el (tmpl)]
        (solid-web:insert (dom:query el "#count") (fn [] @counter))
        (solid-web:insert (dom:query el "#square") (fn [] @square))
        el))))

(solid-web:render
  (fn [] (solid:createComponent Counter #js {}))
  (dom:id->el "app"))
