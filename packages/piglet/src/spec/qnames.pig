(module spec/qnames
  (:import [u :from spec/util])
  (:context {"my-prefix" "https://arnebrasseur.net/vocab/"}))

(u:testing
  "Basic constructions"
  (u:is (= :https://vocabe.piglet-lang.org/package/name (qname "https://vocabe.piglet-lang.org/package/name")))

  "Built-in context"
  (u:is (= :foaf:name :http://xmlns.com/foaf/0.1/name))

  "Module context"
  (u:is (= :my-prefix:fruit :https://arnebrasseur.net/vocab/fruit))

  "Self reference"
  (u:is (= ::fruit :https://piglet-lang.org/pkg/piglet/fruit))
  )
