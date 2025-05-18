# Porting Clojure Code to Piglet

An overview of the most salient differences you'll run into

- Use `:` instead of `/` to separate module and var name, `str:split`, not `str/split`
- There's no `next`, only `rest`
- `contains?` is called `has-key?` (can be used on sets and dicts)
- `str/lower-case` is `str:downcase` (same for `str:upcase`)
- There are no character literals (like `\A` or `\newline`), use strings. E.g. `(= "a" (first "a"))`
- The argument order of `str:split` is reversed, to match `str:join` and to be
  more amenable to partial function application
- `deftype` works completely differently, and `defclass` is also not the same as
  the `defclass` provided by Shadow-cljs. See [Class Syntax](./class_syntax.md).
- `class` creates a new JS class value (possibly anonymous), it follows the
  syntax of `defclass`. It does not return the class of an object. Use `type` or
  `type-name`.
- maps are called dicts, hence `hash-map` / `array-map` is `dict`, `map?` is
  `dict?`
  
