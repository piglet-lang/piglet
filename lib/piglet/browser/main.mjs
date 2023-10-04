// Copyright (c) Arne Brasseur 2023. All rights reserved.

import BrowserCompiler from "./BrowserCompiler.mjs"

import {intern, qsym, symbol, module_registry, prefix_name} from "../lang.mjs"
window.$piglet$ = module_registry.index

const verbosity_str = new URL(import.meta.url).searchParams.get("verbosity")

const compiler = new BrowserCompiler({verbosity: verbosity_str ? parseInt(verbosity_str, 10) : 0})
intern(symbol("piglet:lang:*compiler*"), compiler)

await compiler.load_package(new URL("../../../packages/piglet", import.meta.url))
//await compiler.load_package(new URL("https://cdn.jsdelivr.net/npm/piglet-lang@0.1.32/packages/piglet", import.meta.url))

compiler.load(symbol("piglet:lang")).then(()=>{
    for (const script of document.getElementsByTagName("script")) {
        if(script.type == 'application/piglet' || script.type == 'piglet') {
            if (script.src) {
                compiler.load_file(script.src)
            } else {
                compiler.eval_string(script.innerText)
            }
        }
    }
})
