(module spec/destructuring
  (:import [u :from spec/util]))

;; There are two dimensions to destructuring

;; - the destructuring context : fn/let/for/doseq/def
;; - the destructuring form/type : symbol/vector/dict, dict special keys, and any combination thereof

;; We want to make sure we test the entire space, so we need a test for each
;; combination of (destructuring context)x(destructuring form)

;; See doc/destructuring.adoc for what we aim to support. The order of tests
;; here should generally follow the structure of that document, so we can easily
;; cross-reference.

;; ---- template ----
;; (u:testing
;;   "fn"
;;   (u:is (= ,, ((fn []))))
;;   "let"
;;   (u:is (= ,, (let [])))
;;   "for"
;;   (u:is (= ,, (for [])))
;;   "doseq"
;;   (let [res (reference [])]
;;     (doseq [,,,]
;;       (swap! res conj ,,,))
;;     (u:is (= ,, @res)))
;;   "def"
;;   (def ,,,)
;;   (u:is (= ,,,)))
;; ---- /template ----

(u:testing
  "Binding to a symbol"
  (u:testing
    "fn"
    (u:is (= 1 ((fn [x] x) 1)))
    "let"
    (u:is (= 1 (let [x 1] x)))
    "for"
    (u:is (= [0 1 2] (for [x (range 3)] x)))
    "doseq"
    (let [res (reference [])]
      (doseq [x (range 3)]
        (swap! res conj x))
      (u:is (= [0 1 2] @res)))
    "def"
    (u:is (= nil (resolve 'xxx)))
    (def xxx 1)
    (u:is (= 1 @(resolve 'xxx))))
  )
