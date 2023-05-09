

(def tmpl
  (.createElement js:document "template"))

(set! (.-innerHTML tmpl) "<div>hello</div>")

(.cloneNode tmpl)
