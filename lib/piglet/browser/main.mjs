// Copyright (c) Arne Brasseur 2023. All rights reserved.

import BrowserCompiler from "./BrowserCompiler.mjs"

import {intern, qsym, symbol, module_registry, prefix_name} from "../lang.mjs"
window.$piglet$ = module_registry.packages

const compiler = new BrowserCompiler()
intern(symbol("piglet:lang:*compiler*"), compiler)

console.log("Registering package")
await compiler.load_package("/packages/piglet")

console.log("Loading piglet:lang")
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
