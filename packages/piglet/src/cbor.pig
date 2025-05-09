(module cbor
  "Concise Binary Object Representation (CBOR) encoding/decoding."
  (:import piglet:string))

;; Limitations and choices
;; =======================
;;
;; - We don't yet support reading or writing of Float16
;; - No tags are implemented yet, that means no dates, keywords/symbols/qnames, sets, ...
;; - No support for indefinite length strings and byte strings (terminated with 0xFF "break")
;; - CBOR key-value maps (major type 5) are read/written as Dict, rather than
;;   js:Object. This is generally what a Piglet consumer would expect, but it
;;   means we can't write js:Object at the moment. We could also map it to major
;;   type 5, but then it no longer round trips. We'll have to study the
;;   available tags some more to see what the most appealing option is to
;;   represent all of Piglet's (and JS's) types

;; Read/write support for CBOR tag numbers is handled through this protocol and
;; multimethod. Note that this is only for number tags as listed in IANA's
;; cbor-tags registry. We (plan to) also encode/decode "tagged items" analoguous
;; to reader tags, with string/IRI tags, which uses CBOR tag 27, "Serialized
;; language-independent object with type name and constructor arguments."
(defprotocol CBORTagged
  (-cbor-tag-number [_])
  (-cbor-value [_]))

(defmulti read-tagged! (fn [tag value] tag))

;; Initial write buffer size, will grow as needed. Too small and we do too many
;; allocations and buffer copying, too big and we waste memory. Not sure yet
;; what the sweet spot it. cbor.js uses 256.
(def BUFFER_SIZE 512)

;; This state structure is used for both reads and writes. We implemented reads
;; first, in which case the only mutable part is the offset, which is why that
;; is a box. For writes we need to be able to grow the buffer, so in the
;; write case we pass the state map through the process so we can swap out the
;; buffer and dataview, while also mutating the offset in place. It's a bit
;; messy.
(defn buffer->state
  "Construct the 'state' map we pass around, containing the
  buffer itself, a dataview over the buffer, and a mutable offset, which
  increments as we read/write more data to/from the buffer."
  [buffer]
  {:buffer   buffer
   :dataview (js:DataView. buffer)
   :offset   (box 0)})

(defmacro defreader [name method size]
  `(defn ~name [state#]
     (let [offset# (:offset state#)
           dataview# (:dataview state#)
           o# @offset#]
       (if (<= (.-byteLength dataview#) o#)
         ::eof
         (do
           (swap! offset# + ~size)
           (~(symbol (str "." method)) dataview# o#))))))

(defreader read-byte! getUint8 1)
(defreader read-ui8! getUint8 1)
(defreader read-i16! getInt16 2)
(defreader read-i32! getInt32 4)
(defreader read-ui16! getUint16 2)
(defreader read-ui32! getUint32 4)
(defreader read-float32! getFloat32 4)
(defreader read-float64! getFloat64 8)

(defn read-ui64!
  "Read a 4-byte positive integer, returns a BigNum if the value is greater than
  Number.MAX_SAFE_INTEGER"
  [{:keys [dataview offset]}]
  (let [o (deref offset)]
    (if (<= (.-byteLength dataview) o)
      ::eof
      (let [first-half (.getUint32 dataview o)]
        (if (<= first-half 0x1f_ffff)
          (let [second-half (.getUint32 dataview (+ o 4))
                value (+ (* first-half (power 2 32))
                        second-half)]
            (swap! offset + 8)
            value)
          (let [value (.getBigUint64 dataview o)]
            (swap! offset + 8) value))))))

(defn read-byte-array! [{:keys [buffer offset]} length]
  (.slice buffer @offset (swap! offset + length)))

(defn read-utf8! [{:keys [buffer offset]} length]
  (let [text (.decode (js:TextDecoder.)
               (js:Uint8Array. buffer @offset length))]
    (swap! offset + length)
    text))

(defn read-multibyte-argument! [argument state]
  (cond
    (< argument 24) argument
    (= 0x18 argument) (read-ui8! state)
    (= 0x19 argument) (read-ui16! state)
    (= 0x1a argument) (read-ui32! state)
    (= 0x1b argument) (read-ui64! state)))

(defn read-value! [state]
  (let [byte (read-byte! state)
        major-type (bit-shift-right byte 5)
        argument (bit-and byte 2r0001_1111)]
    (cond
      ;; positive integers up to 2^64-1
      (= 0 major-type)
      (read-multibyte-argument! argument state)

      ;; negative integers up to -2^64
      (= 1 major-type)
      (cond
        (< argument 24) (- -1 argument)
        (= 24 argument) (- -1 (read-ui8! state))
        (= 25 argument) (- -1 (read-ui16! state))
        (= 26 argument) (- -1 (read-ui32! state))
        (= 27 argument) (let [n (read-ui64! state)]
                          (if (<= js:Number.MAX_SAFE_INTEGER n)
                            (- (js:BigInt -1) (js:BigInt n))
                            (- -1 n))))

      ;; generic sequence of bytes
      (= 2 major-type)
      (read-byte-array! state (read-multibyte-argument! argument state))

      ;; UTF-8 text string
      (= 3 major-type)
      ;; We can theoretically read up to 53 bits of length, depending on the
      ;; system.
      (read-utf8! state (read-multibyte-argument! argument state))

      ;; Sequence of arbitrary values -> JS Array
      (= 4 major-type)
      (js:Array.from (range (read-multibyte-argument! argument state))
        (fn [_] (read-value! state)))

      ;; Key-value mapping -> Dict
      (= 5 major-type)
      (apply dict
        (for [_ (range (* 2 (read-multibyte-argument! argument state)))]
          (read-value! state)))

      ;; Tagged value (numeric tag up to 2^64-1, IANA registry)
      (= 6 major-type)
      (read-tagged! (read-multibyte-argument! argument state) (read-value! state))

      ;; Special values and floats
      (= 7 major-type)
      (cond
        (= 20 argument) false
        (= 21 argument) true
        (= 22 argument) nil
        (= 23 argument) undefined

        (= 25 argument) nil ;; float-16...
        (= 26 argument) (read-float32! state)
        (= 27 argument) (read-float64! state)))))

(defn decode
  "Given an ArrayBuffer, read a single CBOR value"
  [buffer]
  (let [state (buffer->state buffer)]
    (read-value! state)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Writing

(defn ensure-buffer-size [state bytes]
  (let [current-size (.-byteLength (:buffer state))]
    (if (< current-size (+ @(:offset state) bytes))
      (let [new-buffer (js:ArrayBuffer. (* current-size 2))]
        ;; It doesn't seem to matter much which kind of TypedArray is used for
        ;; the copying, but in some environments Float64Array seemed to be a tad
        ;; faster than the other ones.
        (.set (js:Float64Array. new-buffer) (js:Float64Array. (:buffer state)))
        (let [new-state (assoc state :buffer new-buffer :dataview (js:DataView. new-buffer))]
          ;; Check again, in case doubling the buffer size was not yet enough
          ;; TODO: immediately calculate the right size, rather than repeatedly
          ;; allocating bigger buffers. Will be easier once we have loop/recur.
          (ensure-buffer-size new-state bytes)))
      state)))

(defmacro defwriter [name method size]
  `(defn ~name [state# value#]
     (let [state# (ensure-buffer-size state# ~size)
           offset# (:offset state#)
           dataview# (:dataview state#)
           o# @offset#]
       (swap! offset# + ~size)
       (~(symbol (str "." method)) dataview# o# value#)
       state#)))

(defwriter write-byte! setUint8 1)
(defwriter write-ui8! setUint8 1)
(defwriter write-i16! setInt16 2)
(defwriter write-i32! setInt32 4)
(defwriter write-ui16! setUint16 2)
(defwriter write-ui32! setUint32 4)
(defwriter write-float32! setFloat32 4)
(defwriter write-float64! setFloat64 8)
(defwriter write-bigint64! setBigUint64 8)

(defprotocol CBOREncodable
  (-write! [this state]))

(defn not-implemented [message]
  (throw (js:Error. (str "Not implemented: " message))))

(defn write-length-arg! [type-marker state bytes]
  (cond
    (< bytes 24)
    (write-byte! state (bit-or type-marker bytes))

    (<= bytes 0xFF)
    (-> state
      (write-byte! (bit-or type-marker 0x18))
      (write-ui8! bytes))

    (<= bytes 0xFFFF)
    (-> state
      (write-byte! (bit-or type-marker 0x19))
      (write-ui16! bytes))

    (<= bytes 0xFFFF_FFFF)
    (-> state
      (write-byte! (bit-or type-marker 0x1a))
      (write-ui32! bytes))

    ;; Encoding strings larger than 2^32 is not supported on all platforms,
    ;; due to limits on the size of ArrayBuffer. At most it will be
    ;; MAX_SAFE_INTEGER, or 2^53-1, so writing 64-bit lengths is more
    ;; theoretical, but included for completeness. (You'd be looking at a
    ;; single string of more than 4GiB).
    :else
    (-> state
      (write-byte! (bit-or type-marker 0x1b))
      (write-bigint64! (js:BigInt bytes)))))

(defn write-value! [state value]
  (cond
    (=== nil value)
    (write-byte! state 0xF6)
    (=== undefined value)
    (write-byte! state 0xF7)
    (satisfies? CBORTagged value)
    (->
      (write-length-arg! 0xC0 state (-cbor-tag-number value))
      (write-value! (-cbor-value value)))
    :else
    (-write! value state)))

(extend-protocol CBOREncodable
  js:Number
  (-write! [this state]
    (if (js:Number.isInteger this)
      (cond
        (< this -0x10000_0000)
        (do
          (write-byte! state 0x3B)
          (write-bigint64! state (- (+ (js:BigInt this) (js:BigInt 1)))))

        (< this -0x1_0000)
        (do
          (write-byte! state 0x3A)
          (write-ui32! state (- (inc this))))

        (< this -0x100)
        (do
          (write-byte! state 0x39)
          (write-ui16! state (- (inc this))))

        (< this -24)
        (do
          (write-byte! state 0x38)
          (write-ui8! state (- (inc this))))

        (< this 0)
        (write-byte! state (bit-or 0x20 (- (inc this))))

        (< this 24)
        (write-ui8! state this)

        (< this 0x100)
        (do
          (write-ui8! state 0x18)
          (write-ui8! state this))
        (< this 0x1_0000)
        (do
          (write-ui8! state 0x19)
          (write-ui16! state this))
        (< this 0x1_0000_0000)
        (do
          (write-ui8! state 0x1A)
          (write-ui32! state this))

        :else
        (do
          (write-ui8! state 0x1B)
          ;; can't left-shift numbers greater than 32 bits
          (write-ui32! state (/ this 0x1_0000_0000))
          (write-ui32! state (bit-and this 0xFFFF_FFFF))))

      ;; floats
      (if (or (js:isNaN this) (=== this (js:Math.fround this)))
        ;; TODO: we should at least encode NaN/Inf/0.0 as float16 for
        ;; compactness, like clj-cbor
        ;; float16: not supported
        ;; float32
        (let [state (write-byte! state 0xFA)]
          (write-float32! state this))
        ;; float64
        (let [state (write-byte! state 0xFB)]
          (write-float64! state this)))))

  js:BigInt
  (-write! [this state]
    (cond
      (< this (js:BigInt "-18446744073709551616"))
      (not-implemented "negative bigint of more than 64 bits")

      (< this js:Number.MIN_SAFE_INTEGER)
      (do
        (write-byte! state 0x3B)
        (write-bigint64! state (- (+ this (js:BigInt 1)))))

      (<= this js:Number.MAX_SAFE_INTEGER)
      (-write! (js:BigInt.asIntN this) state)

      (< this (js:BigInt "18446744073709551616"))
      (do
        (write-byte! state 0x1B)
        (write-bigint64! state this))

      :else
      (not-implemented "positive bigint of more than 64 bits")))

  js:ArrayBuffer
  (-write! [this state]
    (let [bytes (.-byteLength this)
          state (write-length-arg! 0x40 state bytes)
          state (ensure-buffer-size state bytes)
          o @(:offset state)]
      (swap! (:offset state) + bytes)
      (.set
        (js:Uint8Array. (:buffer state) o bytes)
        (js:Uint8Array. this))
      state))

  js:String
  (-write! [this state]
    (let [encoded (.encode (js:TextEncoder.) this)
          bytes (.-byteLength encoded)
          state (write-length-arg! 0x60 state bytes)
          state (ensure-buffer-size state bytes)
          o @(:offset state)]
      (swap! (:offset state) + bytes)
      (.set
        (js:Uint8Array. (:buffer state) o bytes)
        encoded)
      state))

  js:Array
  (-write! [this state]
    (let [state (write-length-arg! 0x80 state (.-length this))]
      (reduce write-value! state this)))

  AbstractSeq
  (-write! [this state]
    (let [state (write-length-arg! 0x80 state (count this))]
      (reduce write-value! state this)))

  Dict
  (-write! [this state]
    (let [state (write-length-arg! 0xA0 state (count this))]
      (reduce (fn [acc [k v]]
                (-> acc
                  (write-value! k)
                  (write-value! v)))
        state this)))

  js:Boolean
  (-write! [this state]
    (if this
      (write-byte! state 0xF5)
      (write-byte! state 0xF4))))

(defn encode
  "Encode a value to CBOR"
  [value]
  (let [state (buffer->state (js:ArrayBuffer. BUFFER_SIZE))
        {:keys [buffer offset]} (write-value! state value)]
    (.slice buffer 0 @offset)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Tagged values

(extend-protocol CBORTagged
  AbstractIdentifier
  (-cbor-tag-number [_] 39)
  (-cbor-value [this] (.toString this)))

(defmethod read-tagged! :default [tag value]
  (not-implemented (str "Reader for CBOR tag " tag) ))

(defmethod read-tagged! 39 [_ value]
  (parse-identifier value))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Testing, to be moved elsewhere

(set! *data-readers*
  {"bigint" (fn [o] (js:BigInt o))})

(comment
  (defn hex-buffer [& args]
    (.-buffer
      (js:Uint8Array.
        (mapcat (fn [line]
                  (map (fn [h]
                         (js:parseInt h 16))
                    (re-seq %r/[0-9A-Z]{2}/
                      (string:replace line %r/#.*/ "")))) args))))


  (defn array-buffer [a]
    (.-buffer (js:Uint8Array. a)))

  (extend-type js:BigInt
    TaggedValue
    (-tag [_] "bigint")
    (-tag-value [this] (.toString this)))

  (set! *verbosity* 0)

  (do
    (def test-cases
      [;; 0 - positive integers
       [["00"] 0]
       [["17"] 23]
       [["18 18"] 24]
       [["18 FF"] 255]
       [["19 0100"] 256]
       [["19 FFFF"] 65535]
       [["1A 0001 0000"] 65536]
       [["1A FFFF FFFF"] 4294967295]
       [["1B 0000 0001 0000 0000"] 4294967296]
       [["1B 001FFFFFFFFFFFFF"] js:Number.MAX_SAFE_INTEGER]
       [["1B 0020000000000000"] #bigint "9007199254740992"]
       [["1B FFFF FFFF FFFF FFFF"] #bigint "18446744073709551615"]

       ;; 1 - negative integers
       [["20"] -1]
       [["37"] -24]
       [["38 18"] -25]
       [["38 FF"] -256]
       [["39 0100"] -257]
       [["39 FFFF"] -65536]
       [["3A 00010000"] -65537]
       [["3A FFFFFFFF"] -4294967296]
       [["3B 0000000100000000"] -4294967297]
       [["3B 001FFFFFFFFFFFFE"] -9007199254740991]
       [["3B 001FFFFFFFFFFFFF"] #bigint "-9007199254740992"]
       [["3B 0020000000000000"] #bigint "-9007199254740993"]
       [["3B FFFFFFFFFFFFFFFF"] #bigint "-18446744073709551616"]

       ;; 2 - byte arrays
       [["45            # bytes(5)"
         "  0102030405  # \u0001\u0002\u0003\u0004\u0005"]
        (array-buffer [1 2 3 4 5])]

       [["45            # bytes(5)"
         "  00 02 03 04 FF  # \u0001\u0002\u0003\u0004\u0005"]
        (array-buffer [0 2 3 4 255])]
       [["40"] (array-buffer [])]

       ;; 3 - UTF-8 strings
       [["60"] ""]
       [["63        # text(3)"
         "   616263 # abc"] "abc"]
       [[
         "78 27 # text(39)"
         "   286D6F64756C652063626F720A2020283A696D70"
         "   6F7274207069676C65743A737472696E672929"
         ]"(module cbor\n  (:import piglet:string))"]

       ;; 4 - sequences
       [["80"] []]
       [["83 01 02 03"] [1 2 3]]

       [["85       # array(5)"
         "   01    # unsigned(1)"
         "   20    # negative(0)"
         "   41    # bytes(1)"
         "      01 # \"\u0001\""
         "   61    # text(1)"
         "      78 # \"x\""
         "   81    # array(1)"
         "      02 # unsigned(2)"]
        [1 -1 (array-buffer [1]) "x" [2]]]

       ;; 5 - maps/dicts
       [["A1           # map(1)"
         "   63        # text(3)"
         "      666F6F # \"foo\""
         "   63        # text(3)"
         "      626172 # \"bar\""] {"foo" "bar"}]

       ;; 7 - floats and specials
       [["84 F5 F4 F6 F7"] [true false nil undefined]]
       [["FA 461C4200"] 10000.5] ; float32
       [["FB 40934A4584F4C6E7"] 1234.56789] ; float64
       ]))

  (defn byte-to-hex [i]
    (.padStart (string:upcase
                 (.toString i 16)) 2 "0"))

  ;; decode test, returns empty array if all pass
  (reduce
    (fn [acc [hex value]]
      (let [decoded (decode (apply hex-buffer hex))]
        (if (= value decoded)
          acc
          (conj acc [hex value decoded]))))
    []
    test-cases)

  ;; encode test, returns empty array if all pass
  (reduce
    (fn [acc [hex value]]
      (let [encoded (map byte-to-hex (encode value))
            expected (map byte-to-hex (apply hex-buffer hex))]
        (if (= encoded expected)
          acc
          (reduced [value expected encoded]))))
    []
    test-cases)

  ;; round trip
  (reduce
    (fn [acc [hex value]]
      (let [bytes (apply hex-buffer hex)
            decenc (decode (encode value))
            encdec (encode (decode bytes))]
        (if (and (= decenc value) (= encdec bytes))
          acc
          (reduced [value decenc hex encdec]))))
    []
    test-cases))
