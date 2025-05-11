# Piglet quickstart

Grab piglet from npm

```
npm install -g piglet-lang
```

This will install two executables, `piglet` and `pig`. You mainly will use
`pig`. Use `piglet` in script shebang lines, e.g. `#!/usr/bin/env piglet`.

```
COMMAND
  pig  ——  Piglet's project tool

USAGE
  pig [--verbose | -v] [repl | pdp | web | aot] [<args>...]

FLAGS
  -v, --verbose  Increase verbosity  

SUBCOMMANDS
  repl          Start a Piglet REPL                                     
  pdp           Connect to Piglet Dev Protocol server (i.e. your editor)
  web           Start dev-server for web-based projects                 
  aot <module>  AOT compile the given module and its dependencies       
```

- `pig repl` start a node-based REPL in the terminal
- `pig pdp` is for interactive programming (see later)
- `pig web` starts a web server for using piglet in the browser
- `pig aot` compiles a module in your project (experimental)

The root of a piglet project should contain a `package.pig`

```
{:pkg:name https://my.org/piglet-packages/my-pkg
 :pkg:paths ["src"]}
```

Piglet module names follow the file system starting from `:pkg:paths`, create
`src/my/first/module.pig`

```lisp
(module my/first/module
  (:import
    [t :from piglet:cli/terminal]))

(println (t:fg :magenta "Cooking with gas!"))
```

Run it with

```
bin/pig run my/first/module
```

## Emacs

The [piglet-emacs](https://github.com/piglet-lang/piglet-emacs) package contains
`piglet-mode.el`, a treesitter-based mode with indentation and syntax
highlighting, `pdp.el`, which implements the server side of the Piglet Dev
Protocol, used for interactive programming, and `piglet-company.el`, which uses
PDP to provide completion candidates to company-mode.

Piglet-emacs is not available from MELPA. If you're using the Straight
functional package manager for emacs, then you get piglet-emacs via the
corgi-packages repository.

```lisp
(use-package corgi-packages
  :straight (corgi-packages
             :type git
             :host github
             :repo "corgi-emacs/corgi-packages"))

(add-to-list #'straight-recipe-repositories 'corgi-packages)

(use-package piglet-emacs)
```

Or just clone piglet-emacs and load the provided `.el` files manually. See
`piglet-emacs-pkg.el` for a list of dependencies that it needs. These are all
available from MELPA.

## PDP

To provide interactive programming facilities Piglet uses a message based
protocol over websockets, using CBOR as the over-the-wire format. This is known
as Piglet Dev Protocol or PDP.

In the PDP model your editor is the server, and the Piglet runtime connects to
it on a well known port (17017). It's done this way and not the other way around
so that we can use the same mechanism from the browser as well as from other
runtimes like node.js.

First, in emacs, start the PDP server, `M-x pdp-start-server!`.

Then, start a piglet runtime in your project, connecting to PDP: `pig pdp`

You'll see a message in your minibuffer: 

```
[Piglet] PDP conn opened, 1 active connections
```

PDP offers a slew of `eval` variants, determining what is being evaluated, and
where the result is displayed.

```
pdp-eval-{last-sexp,outer-sexp,buffer,region}-to-{minibuffer,insert,result-buffer,repl}
```

For instance `eval-last-sexp-to-insert`, `pdp-eval-region-to-result-buffer`, etc.

Note: all of these also have a `...-pretty-print` variant, support for pretty
printing however is not yet implemented on the client.

## Web

To use piglet in a browser, you can use `pig web` in your project. This will
start a web server on port 1234, which when accessed will load the piglet
compiler, the PDP client, and your main module (if you have a `:pkg:main` in
your `package.pig`). From there you can eval and develop in the same way as you
would do on node.js.

## AOT

AOT or ahead-of-time compilation refers to transpiling Piglet modules to ES6
modules. These can then be further bundled using esbuild, rollup, vite, etc.

This is currently mainly a proof of concept. The main difference between how
code is generated in AOT mode vs when loading Piglet code at runtime or
evaluating it in the REPL, is that AOT compilation compiles Piglet vars to JS
variables, and uses ES6 import/export statements, instead of referencing a
global module registry. This opens the door to tree shaking (dead code
elimination). Note that much of Piglet's supporting code written in JS currently
does not tree shake very well.

To try out AOT compilation and see what the result looks like, you can use `pdp
aot <your-module>`. The result is written to the `target/` directory.
