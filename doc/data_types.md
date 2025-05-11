# Piglet Data Types (WIP)

Reference documentation for JS types and how they are used in Piglet, as well as
the data types that Piglet itself brings to the table.

## Primitives

### nil

The JS special value `null`, typically used to indicate the absence of a result
or value, is represented in Piglet as `nil`.

Piglet supports extending protocols to `nil`, and this is used extensively to
provide "nil-punning", meaning `nil` can in many operations stand in for an
empty list or empty dict.

```piglet
(conj nil 1 2 3) => (3 2 1)
(assoc nil :sound "oink") => {:sound "oink"}
```

### undefined

The JS special value `undefined` is available, but its use is discouraged.
Generally Piglet built-ins will only ever return a value or `nil`, but not
undefined.

### Boolean

`true` and `false` are used to indicate boolean truth and falsehood. Note that
Piglet's notion of truthyness differs from JavaScript. Only `false` and `nil`
(and, should you encounter it, `undefined`) are considered falsy, everything
else including `0` and the empty string, are considered truthy.

