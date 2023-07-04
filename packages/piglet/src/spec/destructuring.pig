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

(u:testing
  "Sequential destructuring"
  (u:testing
    "fn"
    (u:is (= [0 1 2] ((fn [[x y z]] [x y z]) (range 3))))
    (u:is (= [0 1] ((fn [[x y]] [x y]) (range 10))))
    "let"
    (u:is (= [0 1 2] (let [[x y z] (range 3)] [x y z])))
    (u:is (= [0 1] (let [[x y] (range 10)] [x y])))
    (u:is (= ["a" "b"] (let [[x y] "abcde"] [x y])))
    "for"
    (u:is (= [[0 0] [1 1] [2 2]] (for [[x y] (map vector (range 3) (range 3))] [x y])))
    (u:is (= [[0] [1] [2]] (for [[x] (map vector (range 3) [9 10 11])] [x])))
    "doseq"
    (let [res (reference [])]
      (doseq [[x y] (map vector (range 3) (range 3))]
        (swap! res conj [x y]))
      (u:is (= [[0 0] [1 1] [2 2]] @res)))
    (let [res (reference [])]
      (doseq [[x y] (map vector (range 3) (range 3) (range 3))]
        (swap! res conj [x y]))
      (u:is (= [[0 0] [1 1] [2 2]] @res)))
    "def"
    ;; FIXME
    (u:is (= nil (resolve 'xxx)))
    (def xxx 1)
    (u:is (= 1 @(resolve 'xxx))))
  )

;; (u:testing
;;   "Sequential destructuring - variable sinkhole"
;;   (u:is (= 3 (let [[_ _ c] (range 10)] c))))

(u:testing
   "Sequential destructuring - & splat"
   (u:testing
     "fn"
     (u:is (= [0 [1 2]] ((fn [[x & xs]] [x xs]) (range 3))))
     ;; TODO: make sure `&` is not defined in local scope as a variable
     (u:is (= [0 nil] ((fn [[x & xs]] [x xs]) [1])))
     "let"
     (u:is (= [0 [1 2]] (let [[x & xs] (range 3)] [x xs])))
     (u:is (= [0 nil] (let [[x & xs] (range 1)] [x xs])))
     (u:is (= ["a" ["b" "c" "d" "e"]] (let [[x & xs] "abcde"] [x xs])))
     "for"
     (u:is (= [[0 [1 2]] [0 [1 2]]] (for [[x & xs] [[0 1 2] [0 1 2]]] [x xs])))
     (u:is (= [[0 nil] [0 nil]] (for [[x & xs] [[0] [0]]] [x xs])))
     "doseq"
     (let [res (reference [])]
       (doseq [[x & xs] (map vector (range 3) (range 3))]
         (swap! res conj [x xs]))
       (u:is (= [[0 [0]] [1 [1]] [2 [2]]] @res)))
     (let [res (reference [])]
       (doseq [[x xs] (range 3)]
         (swap! res conj [x xs]))
       (u:is (= [[0 nil] [1 nil] [2 nil]] @res)))
     "def"
     ;; FIXME
     (u:is (= nil (resolve 'xxx)))
     (def xxx 1)
     (u:is (= 1 @(resolve 'xxx))))
     )

(u:testing
  "Sequential destructuring - binding collection :as"
  (u:testing
    "fn"
    (u:is (= [0 1 2 [0 1 2]] ((fn [[x y z :as row]] [x y z row]) (range 3))))
    (u:is (= [0 1 2 [0 1 2]] ((fn [[:as row x y z]] [x y z row]) (range 3))))
    (u:is (= [0 1 [0 1 2 3 4 5]] ((fn [[x y :as row]] [x y row]) (range 5))))
    (u:is (= [0 1 [0 1 2 3 4 5]] ((fn [[:as row x y]] [x y row]) (range 5))))
    "let"
    (u:is (= [0 1 2 [0 1 2]] (let [[x y z :as row] (range 3)] [x y z row])))
    (u:is (= [0 1 2 [0 1 2]] (let [[:as row x y z] (range 3)] [x y z row])))
    (u:is (= [0 1 [0 1 2 3 4 5]] (let [[x y :as row] (range 5)] [x y row])))
    (u:is (= [0 1 [0 1 2 3 4 5]] (let [[:as row x y] (range 5)] [x y row])))
    ;; TODO: add string test to check seqable destructuring
    "for"
    (u:is (= [[0 0 [0 0]] [1 1 [1 1]] [2 2 [2 2]]]
            (for [[x y :as row] (map vector (range 3) (range 3))]
              [x y row])))
    (u:is (= [[0 0 [0 0]] [1 1 [1 1]] [2 2 [2 2]]]
            (for [[:as row x y] (map vector (range 3) (range 3))]
              [x y row])))
    (u:is (= [[0 [0 9]] [1 [1 10]] [2 [2 11]]] 
            (for [[x :as row] (map vector (range 3) [9 10 11])] 
              [x row])))
    (u:is (= [[0 [0 9]] [1 [1 10]] [2 [2 11]]] 
            (for [[:as row x] (map vector (range 3) [9 10 11])] 
              [x row])))
    "doseq"
    (let [res (reference [])]
      (doseq [[x y :as row] (map vector (range 3) (range 3))]
        (swap! res conj [x y row]))
      (u:is (= [[0 0 [0 0]] [1 1 [1 1]] [2 2 [2 2]]] @res)))
    (let [res (reference [])]
      (doseq [[:as row x y] (map vector (range 3) (range 3))]
        (swap! res conj [x y row]))
      (u:is (= [[0 0 [0 0]] [1 1 [1 1]] [2 2 [2 2]]] @res)))
    (let [res (reference [])]
      (doseq [[x :as row] (map vector (range 3) (range 3) (range 3))]
        (swap! res conj [x row]))
      (u:is (= [[0 [0 0 0]] [1 [1 1 1]] [2 [2 2 2]]] @res)))
    (let [res (reference [])]
      (doseq [[:as row x] (map vector (range 3) (range 3) (range 3))]
        (swap! res conj [x row]))
      (u:is (= [[0 [0 0 0]] [1 [1 1 1]] [2 [2 2 2]]] @res)))
    "def"
    ;; FIXME
    (u:is (= nil (resolve 'xxx)))
    (def xxx 1)
    (u:is (= 1 @(resolve 'xxx))))
  )

(u:testing
  "Sequential destructuring - combining splat and :as binding"
  (u:testing
    "let"
    (u:is (= [0 [1 2] [0 1 2]] (let [[x & xs :as row] (range 3)] [x xs row])))
    (u:is (= [0 [1 2] [0 1 2]] (let [[:as row x & xs] (range 3)] [x xs row])))
    ;; TODO: this should throw an error
    ;; (u:is (= [0 1 2 [0 1 2]] (let [[x :as row & xs] (range 3)] [x y z row])))
    )
  )

(u:testing
  "Sequential destructuring - nested bindings"
  (u:testing
    "let"
    (u:is (= [1 10 11 2 3] 
            (let [[x [a b] & [m n]] [1 [10 11 12] 2 3 4]]
              [x a b m n])))
    ;; TODO: should throw syntax error
    ;; (u:is (= [1 2 [3 4]] 
    ;;         (let [[x :as [row & row-rest]] [1 2 3 4]]
    ;;           [x row row-rest]))))
    ))

(u:testing
  "Associative destructuring"
  (u:testing
    "fn"
    (u:is (= [1 2] ((fn [{x :a y :b}] [x y])
                     {:a 1 :b 2})))
    "let"
    (u:is (= [1 2] (let [{x :a y :b} {:a 1 :b 2}] [x y])))
    "for"
    (u:is (= [[1 2] [3 4]] (for [{x :a y :b} [{:a 1 :b 2} {:a 3 :b 4}]]
                             [x y])))
    "doseq"
    (let [res (reference [])]
      (doseq [[{x :a y :b} [{:a 1 :b 2} {:a 3 :b 4}]]]
        (swap! res conj x))
      (u:is (= [[1 2] [3 4]] @res)))
    "def"
    ;; FIXME
    (u:is (= nil (resolve 'xxx)))
    (def xxx)
    (u:is (= 1 @(resolve 'xxx))))
  )

(u:testing
  "Associative destructuring - non keyword values"
  (u:testing
    "fn"
    (u:is (= [1 2] ((fn [{x nil y [:a :b]}] [x y])
                     {nil 1 [:a :b] 2})))
    "let"
    (u:is (= [1 2] (let [{x nil y [:a :b]} {nil 1 [:a :b 2]}]
                     [x y])))))

(u:testing
  "Associative destructuring - general binding form"
  (u:testing
    "let"
    (u:is (= [0 1 2]
            (let [{[x y z] :numbers} {:numbers (range 10)}])))))

(u:testing
  "Associative destructuring - extending Lookup"
  (u:testing
    "let"
    (def xy-obj
      (reify
        Lookup
        (get [this k]
          (cond
            (= k :x) 1
            (= k :y) 2
            (= k nil) 3
            (= k [:a :b]) 4
            :else 5))))
    (u:is (= [1 2 3 4 5] 
            (let [{a :x b :y c nil d [:a :b] e :oink} xy-obj]
               [a b c d e])))))

(u:testing
  "Associative destructring - special keys"
  ;; TODO
  )

(u:testing
  "Associative destructring - special keys mixed with default binding"
  ;; TODO
  )

(u:testing
  "Associative destructring - QName lookups with prefix"
  ;; TODO
  )

(u:testing
  "Associative destructring - special keys with :default binding"
  ;; TODO
  )

(u:testing
  "Associative destructring - special keys with :as binding"
  ;; TODO
  )

