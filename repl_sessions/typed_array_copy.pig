(module typed-array-copy)

(def types [
            js:Int8Array
            js:Uint8Array
            js:Int16Array
            js:Uint16Array
            js:Int32Array
            js:Uint32Array
            js:Float32Array
            js:Float64Array
            js:BigInt64Array
            js:BigUint64Array
            ])


(def data (js:ArrayBuffer. 4096))
(def target (js:ArrayBuffer. 4096))

(def dv (js:DataView. data))

(doseq [i (range 4096)]
  (.setUint8 dv i (rand-int 256)))

(doseq [t (reverse types)]
  (println t)
  (time
    (doseq [i (range 10000000)]
      (.set (t. target) (t. data)))))
