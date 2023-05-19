(println "script mode!")

(.inspect (quote https://foo.bar/baz))

(oget  (qsym "https://foo.bar/baz:bar:baq") "var")
