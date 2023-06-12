# 3. Depend on Standards, not Implementations

Date: 2023-06-12

## Status

Accepted

## Context

We want Piglet to have a long and prosperous life, and to avoid changes being
forced upon us by third parties.

## Decision

The core language implementation will not have any concrete dependencies, like
specific libraries or tools. We only depend on specified and accepted standards,
where multiple compatible implementations exist.

Currently the standards we rely upon are:

- EcmaScript, as defined by TC39
- ESTree, as defined by the ESTree steering committee

## Consequences

This decision ensures that you can run Piglet directly from source, and compile
and evaluate forms and modules, with no additional libraries or tooling, given a
compliant JavaScript runtime, and a library that can covert ESTree to
JavaScript, like astring, or escodegen.

This decision is only for the core implementation, we will provide convenience
wrappers for specific contexts and environments, which have concrete
dependencies, to provide a good out-of-the-box experience.

This decision will ensure that, as the world around us changes, Piglet can
continue to find a place in it.
