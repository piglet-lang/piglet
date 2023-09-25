(module web/ui
  (:import
    [i :from "./inferno.mjs"]
    string dom reactive))

(def literal? #{"string" "boolean" "number" "bigint"
                js:Date js:RegExp Sym Keyword PrefixName QName QSym})

(def kebab-case-tags
  #{"accept-charset" "http-equiv" "accent-height"
    "alignment-baseline" "arabic-form" "baseline-shift" "cap-height" "clip-path"
    "clip-rule" "color-interpolation" "color-interpolation-filters" "color-profile"
    "color-rendering" "fill-opacity" "fill-rule" "flood-color" "flood-opacity"
    "font-family" "font-size" "font-size-adjust" "font-stretch" "font-style"
    "font-variant" "font-weight" "glyph-name" "glyph-orientation-horizontal"
    "glyph-orientation-vertical" "horiz-adv-x" "horiz-origin-x" "marker-end"
    "marker-mid" "marker-start" "overline-position" "overline-thickness" "panose-1"
    "paint-order" "stop-color" "stop-opacity" "strikethrough-position"
    "strikethrough-thickness" "stroke-dasharray" "stroke-dashoffset"
    "stroke-linecap" "stroke-linejoin" "stroke-miterlimit" "stroke-opacity"
    "stroke-width" "text-anchor" "text-decoration" "text-rendering"
    "underline-position" "underline-thickness" "unicode-bidi" "unicode-range"
    "units-per-em" "v-alphabetic" "v-hanging" "v-ideographic" "v-mathematical"
    "vert-adv-y" "vert-origin-x" "vert-origin-y" "word-spacing" "writing-mode"
    "x-height"})

(def svg-tags
  #{"a" "animate" "animateMotion" "animateTransform" "circle"
    "clipPath" "defs" "desc" "ellipse" "feBlend" "feColorMatrix"
    "feComponentTransfer" "feComposite" "feConvolveMatrix" "feDiffuseLighting"
    "feDisplacementMap" "feDistantLight" "feDropShadow" "feFlood" "feFuncA"
    "feFuncB" "feFuncG" "feFuncR" "feGaussianBlur" "feImage" "feMerge" "feMergeNode"
    "feMorphology" "feOffset" "fePointLight" "feSpecularLighting" "feSpotLight"
    "feTile" "feTurbulence" "filter" "foreignObject" "g" "hatch" "hatchpath" "image"
    "line" "linearGradient" "marker" "mask" "metadata" "mpath" "path" "pattern"
    "polygon" "polyline" "radialGradient" "rect" "script" "set" "stop" "style" "svg"
    "switch" "symbol" "text" "textPath" "title" "tspan" "use" "view"})

(defn convert-attr-name [attr]
  (let [attr (name attr)]
    (if (or
          (kebab-case-tags attr)
          (string:starts-with? attr "data-")
          (string:starts-with? attr "aria-")
          (string:starts-with? attr "hx-"))
      attr
      (string:kebab->dromedary attr))))

(def ^:inline FLAG_HTML_ELEMENT 1)
(def ^:inline FLAG_CLASS_COMPONENT 4)
(def ^:inline FLAG_FUNCTION_COMPONENT 8)

(declare h)

(defn convert-function-component [c]
  (if-let [w (.-pigferno_wrapper_component c)]
    w
    (fn [props context]
      (let [w (i:Component. props context)]
        (set! (.-render w)
          (fn [props]
            (reactive:track-reactions!
              w
              (fn []
                (h (apply c (.-pigferno_args props))))
              (fn [old new]
                (when (not= old new)
                  (.forceUpdate w))))))
        (set! (.-pigferno_wrapper_component c) w)
        w))))

(defn h
  "Convert a representation of HTML as a Piglet data structure into virtual DOM nodes.

   Strings and other literals (numbers, dates, etc.) converted to text nodes.
   Vectors are converted based on the first element.

   - Keyword: used as tag name for a (V)DOM element. Optionally followed by a
     dict of props, followed by child elements
   - Function: used as a component, anything that follows is used as arguments
     for the component
   "
  [o]
  (cond
    (string? o)
    (i:createTextVNode o)

    (literal? (type o))
    (i:createTextVNode o)

    (vector? o)
    (let [[tag & children] o]
      (cond
        (= :<> tag)
        (i:createFragment (into-array (map h children)) 0)

        (keyword? tag)
        (let [[base tag id klasses] (dom:split-tag tag)
              [props & children*] children
              [props children] (if (dict? props)
                                 [props children*]
                                 [nil children])]
          (i:createVNode FLAG_HTML_ELEMENT
            tag
            (string:join " " (concat klasses (cond
                                               (sequential? (:class props))
                                               (remove nil? (:class props))
                                               (some? (:class props))
                                               (str (:class props)))))
            (into-array (map h children))
            0
            (into (if id #js {:id id} #js {})
              (map (juxt
                     (comp convert-attr-name first)
                     second)
                (dissoc props :class :ref)))
            (:key (meta o))
            (:ref props)))

        (fn? tag)
        (i:createComponentVNode FLAG_CLASS_COMPONENT
          (convert-function-component tag)
          #js {:pigferno_args children}
          (:key (meta o))
          nil)))

    (sequential? o)
    (i:createFragment (into-array (map h o)) 0)
    ))

(defn render
  "Mount the Piglet html form `input` in the DOM element `parent-dom`."
  [parent-dom input]
  (i:render (h input) parent-dom))
