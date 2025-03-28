(module test
  (:import
    [s :from piglet:string]))

(println (s:replace "xxx" %r"x" "y"))
(println #'expand-qnames)
