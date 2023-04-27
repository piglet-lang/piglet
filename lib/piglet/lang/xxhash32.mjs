// Extracted from the hash-wasm project, and inlined here, with minimal JS
// WebAssembly interface, and modified to return a 32 bit integer rather than a
// hex encoded string.

// Based on: https://github.com/Daninet/hash-wasm
// Revision: bd3a205ca5603fc80adf71d0966fc72e8d4fa0ef

//// hash-wasm LICENSE file:
//
// MIT License
//
// Copyright (c) 2020 Dani Biró
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Special thank you to the authors of original C algorithms:
//     - Alexander Peslyak <solar@openwall.com>
//     - Aleksey Kravchenko <rhash.admin@gmail.com>
//     - Colin Percival
//     - Stephan Brumme <create@stephan-brumme.com>
//     - Steve Reid <steve@edmweb.com>
//     - Samuel Neves <sneves@dei.uc.pt>
//     - Solar Designer <solar@openwall.com>
//     - Project Nayuki
//     - ARM Limited
//     - Yanbo Li dreamfly281@gmail.com, goldboar@163.comYanbo Li
//     - Mark Adler
//     - Yann Collet

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
    base64Lookup[base64Chars.charCodeAt(i)] = i;
}

function getDecodeBase64Length(data) {
    let bufferLength = Math.floor(data.length * 0.75);
    const len = data.length;
    if (data[len - 1] === '=') {
        bufferLength -= 1;
        if (data[len - 2] === '=') {
            bufferLength -= 1;
        }
    }
    return bufferLength;
}
function decodeBase64(data) {
    const bufferLength = getDecodeBase64Length(data);
    const len = data.length;
    const bytes = new Uint8Array(bufferLength);
    let p = 0;
    for (let i = 0; i < len; i += 4) {
        const encoded1 = base64Lookup[data.charCodeAt(i)];
        const encoded2 = base64Lookup[data.charCodeAt(i + 1)];
        const encoded3 = base64Lookup[data.charCodeAt(i + 2)];
        const encoded4 = base64Lookup[data.charCodeAt(i + 3)];
        bytes[p] = (encoded1 << 2) | (encoded2 >> 4);
        p += 1;
        bytes[p] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        p += 1;
        bytes[p] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        p += 1;
    }
    return bytes;
}


// Additional license information for xxhash32.c, which this blob is built from:

/////////////////////////////////////////////////////////////
// xxhash32.h
// Copyright (c) 2016 Stephan Brumme. All rights reserved.
// see http://create.stephan-brumme.com/disclaimer.html
//
// XXHash (32 bit), based on Yann Collet's descriptions, see
// http://cyan4973.github.io/xxHash/
//
// Modified for hash-wasm by Dani Biró
//

const wasm = decodeBase64("AGFzbQEAAAABEQRgAAF/YAF/AGAAAGACf38AAwcGAAEBAgADBAUBcAEBAQUEAQECAgYOAn8BQbCJBQt/AEGACAsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQAAQtIYXNoX1VwZGF0ZQACCkhhc2hfRmluYWwAAw1IYXNoX0dldFN0YXRlAAQOSGFzaF9DYWxjdWxhdGUABQpTVEFURV9TSVpFAwEKswkGBQBBgAkLTQBBAEIANwOoiQFBACAANgKIiQFBACAAQc+Moo4GajYCjIkBQQAgAEH3lK+veGo2AoSJAUEAIABBqIiNoQJqNgKAiQFBAEEANgKgiQELswUBBn8CQCAARQ0AQQBBACkDqIkBIACtfDcDqIkBAkBBACgCoIkBIgEgAGpBD0sNAEEAIAFBAWo2AqCJASABQZCJAWpBAC0AgAk6AAAgAEEBRg0BQQEhAgNAQQBBACgCoIkBIgFBAWo2AqCJASABQZCJAWogAkGACWotAAA6AAAgACACQQFqIgJHDQAMAgsLIABB8AhqIQMCQAJAIAENAEEAKAKMiQEhAUEAKAKIiQEhBEEAKAKEiQEhBUEAKAKAiQEhBkGACSECDAELQYAJIQICQCABQQ9LDQBBgAkhAgNAIAItAAAhBEEAIAFBAWo2AqCJASABQZCJAWogBDoAACACQQFqIQJBACgCoIkBIgFBEEkNAAsLQQBBACgCkIkBQfeUr694bEEAKAKAiQFqQQ13QbHz3fF5bCIGNgKAiQFBAEEAKAKUiQFB95Svr3hsQQAoAoSJAWpBDXdBsfPd8XlsIgU2AoSJAUEAQQAoApiJAUH3lK+veGxBACgCiIkBakENd0Gx893xeWwiBDYCiIkBQQBBACgCnIkBQfeUr694bEEAKAKMiQFqQQ13QbHz3fF5bCIBNgKMiQELIABBgAlqIQACQCACIANLDQADQCACKAIAQfeUr694bCAGakENd0Gx893xeWwhBiACQQxqKAIAQfeUr694bCABakENd0Gx893xeWwhASACQQhqKAIAQfeUr694bCAEakENd0Gx893xeWwhBCACQQRqKAIAQfeUr694bCAFakENd0Gx893xeWwhBSACQRBqIgIgA00NAAsLQQAgATYCjIkBQQAgBDYCiIkBQQAgBTYChIkBQQAgBjYCgIkBQQAgACACayIBNgKgiQEgAUUNAEEAIQEDQCABQZCJAWogAiABai0AADoAACABQQFqIgFBACgCoIkBSQ0ACwsLzAICAX4Gf0EAKQOoiQEiAKchAQJAAkAgAEIQVA0AQQAoAoSJAUEHd0EAKAKAiQFBAXdqQQAoAoiJAUEMd2pBACgCjIkBQRJ3aiECDAELQQAoAoiJAUGxz9myAWohAgsgAiABaiECQZCJASEBQQAoAqCJASIDQZCJAWohBAJAIANBBEgNAEGQiQEhBQNAIAUoAgBBvdzKlXxsIAJqQRF3Qa/W074CbCECIAVBCGohBiAFQQRqIgEhBSAGIARNDQALCwJAIAEgBEYNACADQZCJAWohBQNAIAEtAABBsc/ZsgFsIAJqQQt3QbHz3fF5bCECIAUgAUEBaiIBRw0ACwtBACACQQ92IAJzQfeUr694bCIBQQ12IAFzQb3cypV8bCIBQRB2IAFzIgFBGHQgAUEIdEGAgPwHcXIgAUEIdkGA/gNxIAFBGHZycq03A4AJCwYAQYCJAQtTAEEAQgA3A6iJAUEAIAE2AoiJAUEAIAFBz4yijgZqNgKMiQFBACABQfeUr694ajYChIkBQQAgAUGoiI2hAmo2AoCJAUEAQQA2AqCJASAAEAIQAwsLCwEAQYAICwQwAAAA")

const {instance} = await WebAssembly.instantiate(wasm)

const {memory, Hash_Init, Hash_Update, Hash_Final, Hash_GetBuffer} = instance.exports

/**
 * Hash a uint8array
 */
export function hash_bytes(uint8) {
    const mem = new Uint8Array(memory.buffer, Hash_GetBuffer(), uint8.byteLength)
    mem.set(uint8)
    Hash_Init(0)
    Hash_Update(uint8.byteLength)
    Hash_Final()
    return new Uint32Array(mem.buffer,mem.byteOffset,1)[0]
}

const text_encoder = new TextEncoder()

/**
 * Hash a string
 */
export function hash_str(s) {
    const mem = new Uint8Array(memory.buffer, Hash_GetBuffer(), s.length*3)
    const {read} = text_encoder.encodeInto(s, mem)
    Hash_Init(0)
    Hash_Update(read)
    Hash_Final()
    return new Uint32Array(mem.buffer,mem.byteOffset,1)[0]
}

export function hash_num(num) {
    return hash_bytes(new Uint8Array(new Float64Array([num]).buffer))
}

// https://stackoverflow.com/a/27952689/1891448
// https://www.boost.org/doc/libs/1_55_0/doc/html/hash/reference.html#boost.hash_combine
export function hash_combine(seed, hash) {
    return seed ^ hash + 0x9e3779b9 + (seed << 6) + (seed >> 2);
}
