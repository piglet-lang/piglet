# Built-in Protocols

## Associative

The `assoc` and `dissoc` functions make use of the `Associative` protocol, for
functional updates (often just copy-on-write) of various associative data
structures. `Associative` is implemented for:

Piglet:
- `dict`
- `set`

JavaScript:
- `null`
- `js:Array` (indexed access)
- `js:Object`
- `js:Set`

## Conjable

The `conj` function make use of the `Conjable` protocol, for functionally adding
one or more elements to a collection. `Conjable` is implemented for:

Piglet:
- `dict`
- `set`
- `cons`
- `list`
- `Context`
- `Range`
- `Repeat`

JavaScript:
- `null`
- `js:Array`
- `js:Object`
- `js:Set`
- `js:Map`

## Counted

Note that more things than these listed can be counted with `count`, but they
require walking a sequence.

Functions:
- `count`

Piglet:
- `list`
- `dict`
- `set`
- `repeat`
- `range`

JavaScript:
- `js:Array`
- `js:Map`
- `js:Set`

## Derefable

Functions
- `deref`, `@`

- `Var`
- `Box`

## DictLike

## Empty

## Eq

## Hashable

## Lookup

## MutableAssociative

## MutableCollection

## Named

## Repr

## Seq

## Seqable

## Sequential

## WithMeta

## Walkable

## QualifiedName

## Watchable

## Swappable

## TaggedValue


