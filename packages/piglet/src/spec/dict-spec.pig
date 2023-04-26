(module :piglet:spec/dict-spec
  (:import [u :from ::spec/util]))

(u:testing
  "Basic constructions"
  (let [m0 {}
        m1 {:foo "bar"}
        m2 {:foo "bar" :bar "baz"}
        m-str-key {"foo" "bar"}
        m-int-key {123 "world"}]
    (u:is (= m0 {}))
    (u:is (= m0 (dict)))
    (u:is (= m1 (.of Dict nil :foo "bar")))
    (u:is (= m1 (dict :foo "bar")))
    (u:is (= m-str-key (assoc {} "foo" "bar")))
    (u:is (= m-int-key {123 "world"})))

  "Retrieving elements"
  (u:is (= (:foo {:foo "bar"}) "bar"))
  )
