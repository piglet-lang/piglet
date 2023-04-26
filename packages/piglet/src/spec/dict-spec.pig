(module :piglet:spec/dict-spec
  (:import [u :from ::spec/util]))

(u:testing
  "Basic constructions"
  (u:is (= {:foo "bar"} (Dict.of nil :foo "bar")))
  (u:is (= {:foo "bar"} (dict :foo "bar")))
  (u:is (= {} (dict))))
