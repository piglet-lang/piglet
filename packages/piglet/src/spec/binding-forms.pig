(module spec/binding-forms
  (:import [u :from spec/util]))

(u:testing
  "let blocks"
  (u:is (= [1 2 3]
          (let [a 1 b 2 c 3]
            [a b c])))
  "nested lets"
  (u:is (= [4 2 3 5]
          (let [a 1 b 2 c 3]
            (let [a 4 d 5]
              [a b c d])))))
