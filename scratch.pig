(+ 1 1)

(def Protocol (.-default (await (js:import "../lib/piglet/lang/Protocol2.mjs"))))

(def p (new Protocol nil "piglet:lang" "Eq",
            [["=" [[["this", "that"] "checks equality"]]]]))
(js:console.log p)

(js:console.dir
 (.-symreg Protocol))

(.intern p *current-module*)

(.-name (first (js:Object.values (.-methods p))))

(reset-meta! (.resolve *current-module* "=") [:a])

(meta (.resolve *current-module* "="))
