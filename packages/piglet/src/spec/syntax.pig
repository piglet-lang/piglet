(module :piglet:spec/syntax
  (:import [u :from ::spec/util]))

(u:testing
 "Syntax"
 (u:is (= (read-string "123") 123))
 (u:is (= (type (read-string "123")) "number")))
