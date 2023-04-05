// Copyright (c) Arne Brasseur 2023. All rights reserved.

import NodeCompiler from "./NodeCompiler.mjs"

import {module_registry, prefix_name} from "../lang.mjs"
global.$bunny$ = module_registry.packages

const compiler = new NodeCompiler()
await compiler.load(prefix_name("bunny", "lang"))
await compiler.load(prefix_name("localpkg", process.argv[2]))
