(module cli/terminal
  "Generate output for VT100/xterm style terminals

  This is a minimal, fairly naive API that handles common use cases, based on
  the largest common denominator of terminal emulator escape code support, not
  an attempt to support every escape code and edge case of every terminal
  emulator."
  (:import
    string))

(def basic-colors
  {:black 0
   :red 1
   :green 2
   :yellow 3
   :blue 4
   :magenta 5
   :cyan 6
   :white 7})

(defn fg
  "Foreground color
  Add escape codes to the given strings so they are printed in a certain
  foreground color. For color use eithe a keyword (see [[basic-colors]]),
  or a 3-integer vector (rgb)."
  [color & strs]
  (str "\u001B["
    (if (keyword? color)
      (+ 30 (get basic-colors color))
      (str "38;2;" (string:join ";" color))) "m"
    (apply str strs) "\u001B[0m"))

(defn bg
  "Background color
  Add escape codes to the given strings so they are printed with a certain
  background color. For color use eithe a keyword (see [[basic-colors]]),
  or a 3-integer vector (rgb)."
  [color & strs]
  (str "\u001B["
    (if (keyword? color)
      (+ 40 (get basic-colors color))
      (str "48;2;" (string:join ";" color)))
    "m" (apply str strs) "\u001B[0m"))
