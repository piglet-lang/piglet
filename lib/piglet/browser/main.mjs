// Copyright (c) Arne Brasseur 2023. All rights reserved.

import BrowserCompiler from "./BrowserCompiler.mjs"

import {intern, qsym, symbol, module_registry, prefix_name} from "../lang.mjs"
window.$piglet$ = module_registry.index

const verbosity_str = new URL(import.meta.url).searchParams.get("verbosity")
const compiler = new BrowserCompiler({})
intern(symbol("piglet:lang:*compiler*"), compiler)
intern(symbol("piglet:lang:*verbosity*"), verbosity_str ? parseInt(verbosity_str, 10) : 0)

// defined as a constant so it's easy to replace when using a build system
const PIGLET_PACKAGE_PATH = new URL("../../../packages/piglet", import.meta.url)
await compiler.load_package(PIGLET_PACKAGE_PATH)

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
