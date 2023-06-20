(module spec/all
  (:import [u :from spec/util])
  (:context {"my-prefix" "https://arnebrasseur.net/vocab/"}))

(u:testing "Numbers"
  (u:testing
    "syntax"
    (u:is (= (read-string "123") 123))
    (u:is (= (type (read-string "123")) "number"))))

(u:testing "Dict"
  (u:testing
    "implements DictLike"
    ;; TODO: this won't always return things in order once we have proper
    ;; persistent dicts
    (u:is (= [:a :b :c] (keys {:a 1 :b 2 :c 3})))
    (u:is (= [1 2 3] (vals {:a 1 :b 2 :c 3}))))

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
      (u:is (= m-int-key {123 "world"}))))

  (u:testing
    "Retrieving elements"
    (u:is (= (:foo {:foo "bar"}) "bar")))
  )

(u:testing "QName"
  (u:testing
    "Basic constructions"
    (u:is (= :https://vocabe.piglet-lang.org/package/name (qname "https://vocabe.piglet-lang.org/package/name")))

    "Built-in context"
    (u:is (= :foaf:name :http://xmlns.com/foaf/0.1/name))

    "Module context"
    (u:is (= :my-prefix:fruit :https://arnebrasseur.net/vocab/fruit))

    "Self reference"
    (u:is (= ::fruit :https://piglet-lang.org/pkg/piglet/fruit))
    ))
