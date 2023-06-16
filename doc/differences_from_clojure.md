# Ways in Which Piglet Differs From Clojure

Piglet has a lot of similarities with Clojure, but also numerous differences. We
try to list the main ones here so people already familiar with Clojure can
quickly get up to speed.

- We use `:` instead of `/` as a separator in symbols and keywords
  - The slash is just a regular character

- the map data structure is called dict 

```piglet
(= {:hello "world"}
   (dict :hello "world"))
(instance? Dict o)
(dict? o)
```

- split / join are part of the core API, and both take the separator first (for
  easy partial'ing)
  
```piglet
(def s (partial split ","))
(def j (partial join "/"))

(j (s "a,b,c"))
=> "a/b/c"
```

