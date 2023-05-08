(module :pdp:pdp-client
  (:import [cbor :from "./cbor.mjs"]))

(println
  (cbor:encode #js {:foo "bar"}))
