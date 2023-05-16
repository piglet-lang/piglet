class Callable {
    constructor(name) {
        const self = {[name](...args) { return self.invoke(...args) }}[name]
        Object.setPrototypeOf(self, Callable.prototype)
        return self
    }

    invoke(a,b,c) {
        return a + b + c
    }
}
Object.setPrototypeOf(Callable.prototype, Function)

class Obj {
    invoke(a,b,c) {
        return a + b + c
    }
}

function simple_function(a,b,c) {
    return a + b + c
}

const obj = new Obj()
const callable = new Callable("my-fn")
//warmup
console.log([...Array(10000).keys()].reduce((acc,x) => obj.invoke(acc,x,x)))
console.log([...Array(10000).keys()].reduce((acc,x) => callable(acc,x,x)))
console.log([...Array(10000).keys()].reduce((acc,x) => simple_function(acc,x,x)))
console.log([...Array(10000).keys()].reduce((acc,x) => obj.invoke(acc,x,x)))
console.log([...Array(10000).keys()].reduce((acc,x) => callable(acc,x,x)))
console.log([...Array(10000).keys()].reduce((acc,x) => simple_function(acc,x,x)))

console.time("object")
console.log([...Array(100000).keys()].reduce((acc,x) => obj.invoke(acc,x,x)))
console.timeEnd("object")

console.time("callable")
console.log([...Array(100000).keys()].reduce((acc,x) => callable(acc,x,x)))
console.timeEnd("callable")

console.time("simple_function")
console.log([...Array(100000).keys()].reduce((acc,x) => simple_function(acc,x,x)))
console.timeEnd("simple_function")

console.time("object")
console.log([...Array(100000).keys()].reduce((acc,x) => obj.invoke(acc,x,x)))
console.timeEnd("object")

console.time("callable")
console.log([...Array(100000).keys()].reduce((acc,x) => callable(acc,x,x)))
console.timeEnd("callable")

console.time("simple_function")
console.log([...Array(100000).keys()].reduce((acc,x) => simple_function(acc,x,x)))
console.timeEnd("simple_function")
