(module spec/all
  (:import
    [u :from spec/util]
    [_ :from spec/destructuring]
    [_ :from spec/binding-forms])
  (:context {"my-prefix" "https://arnebrasseur.net/vocab/"}))

;; Primitives

(u:testing "Numbers"
  (u:testing
    "basic syntax"
    (u:is (= (type (read-string "123")) "number"))
    (u:is (= (read-string "123") 123))
    (u:is (= (read-string "123.45") 123.45))))

(u:testing "Strings"
  (u:testing
    "basic syntax"
    (u:is (= "string" (type (read-string "\"abc\""))))
    (u:is (= "abc" (read-string "\"abc\"")))
    (u:is (= %q(abc) "abc"))
    "escape sequences"
    (u:is (= 10 (.charCodeAt "\n" 0)))
    (u:is (= 9 (.charCodeAt "\t" 0)))
    (u:is (= "✊" "\u270a"))
    (u:is (= "✊" "\u270A"))
    (u:is (= "🨅" "\u{1fa05}"))
    "Seqable"
    (u:is (= ["a" "b" "c"] (seq "abc")))))

(u:testing "Regexp"
  (u:testing
    "basic syntax"
    (u:is (= %r"^a.*z$"m (js:RegExp. "^a.*z$" "m")))
    "escaping"
    (u:is (= %r"a\"b" (js:RegExp. "a\"b")))
    (u:is (= %r/a\/b/ (js:RegExp. "a/b")))
    "freespacing (x)"
    (u:is (= %r/
            This\ regex #
            /x
            (js:RegExp. "This regex")))
    "stringify"
    (u:is (= "%r/x/g" (str %r/x/g)))))

(u:testing "QName"
  (u:testing
    "Basic constructions"
    (u:is (= :https://vocabe.piglet-lang.org/package/name (qname "https://vocabe.piglet-lang.org/package/name")))

    "Built-in context"
    (u:is (= :foaf:name :http://xmlns.com/foaf/0.1/name))

    "Module context"
    (u:is (= :my-prefix:fruit :https://arnebrasseur.net/vocab/fruit))

    "Self reference"
    (u:is (= ::fruit :https://piglet-lang.org/packages/piglet#fruit))
    ))

;; Collections

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
    (u:is (= (:foo {:foo "bar"}) "bar"))))

(u:testing "HashSet"
  (u:testing
    "basic syntax"
    (u:is (= #{1 2 3} (HashSet.of nil 1 2 3)))
    (u:is (= #{1 2 3 4} #{4 3 2 1 2 3 4}))
    (u:is (= #{1 2 3} (set [1 2 3])))
    (u:is (= #{1 2 3} #{(inc 0) (+ 1 1) (/ 6 2)}))
    "use as a function"
    (u:is (= 1 (#{1 2 3} 1)))
    (u:is (= nil (#{1 2 3} 4)))
    "conj / dissoc"
    (u:is (= #{1 2 3 4} (conj #{1 2 3} 4)))
    (u:is (= #{1 2 3} (conj #{1 2 3} 3)))
    (u:is (= #{1 2} (dissoc #{1 2 3} 3)))
    (u:is (= #{1 2 3} (dissoc #{1 2 3} 4)))
    "predicate"
    (u:is (set? #{}))
    (u:is (set? #{1 2}))
    (u:is (not (set? nil)))
    (u:is (not (set? (js:Set.))))
    "Counted"
    (u:is (= 2 (count #{1 2})))))

(u:testing "Dynamic bindings"
  (u:is (= 3 (binding [#'*verbosity* 3] *verbosity*))))

(defn recursive-function [n]
  (if (< 5 n) n (recur (inc n))))

(u:testing
  "Loop/recur"
  (u:testing
    "Function as loop-head"
    (u:is (= 6 (recursive-function 0)))
    "loop/recur"
    (u:is (= 6 (loop [n 0] (if (< 5 n) n (recur (inc n))))))))

;; Regressions

(u:testing
  "Map works on iterator (no double consumption)"
  (u:is (= [["x"] ["x"] ["x"]]
          (map identity
            (.matchAll "xxx" %r/x/g)))))
