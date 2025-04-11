# Porting Clojure Code to Piglet

An overview of the most salient differences you'll run into

- Use `:` instead of `/` to separate module and var name, `str:split`, not `str/split`
- There's no `next`, only `rest`
- `contains?` is called `has-key?`
- `str/lower-case` is `str:downcase` (same for `str:upcase`)
- There are no character literals (like `\A` or `\newline`), use strings. E.g. `(= "a" (first "a"))`
- The argument order of `str:split` is reversed, to match `str:join` and to be
  more amenable to partial function application
