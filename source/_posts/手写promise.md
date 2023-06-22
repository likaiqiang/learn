---
title: 手写promise
date: 2023-06-21 22:37:56
tags:
---
Promise这个构造函数与别的不一样，尽管平时使用时比较爽，但是站在函数设计者的角度来看就比较怪异。首先构造函数的参数是个函数（executor），这个函数的两个参数resolve与reject又是两个函数，且是在Promise构造函数内部定义的，调用executor时需要作为executor的参数。

Promise的then方法的参数又是两个函数（onFulfilled与onRejected），这两函数会在该promise实例resolve或者reject时分别调用，且then方法还可以链式调用与值穿透。看起来很像一堆函数在互相作用，但Promise的用法却是面向对象的方式，所以容易让人困惑。

先不考虑then方法的链式调用与值穿透，实现一个简易版的promise。
# 一个普通的不支持链式调用的promise
```javascript
function MyPromise(executor){ // 这个executor便是我们new Promise时传的函数
    this.value = undefined // promise实例resolve时的值
    this.reason = undefined // promise实例reject时的原因
    this.status = 'pending' // promise实例的状态
    this.onResolvedCallbacks = [] //用来存储then方法的onFulfilled方法，因为then方法可以被链式调用，所以这个参数是个数组。
    this.onRejectedCallbacks = [] //用来存储then方法的onRejected方法，因为then方法可以被链式调用，所以这个参数是个数组。
    const self = this
    
    function resolve(value){
        if (self.status === 'pending') {
            self.status = 'resolve';
            self.value = value;
            self.onResolvedCallbacks.forEach(function (fn) { return fn(); });
        }
    }
    // resolve方法的作用是改变promise的status与value，并依次执行onResolvedCallbacks里面的onFulfilled
    function reject(reason){
        if (self.status === 'pending') {
            self.status = 'reject';
            self.reason = reason;
            self.onRejectedCallbacks.forEach(function (fn) { return fn(); });
        }
    }
    //reject方法与resolve相反
    executor(resolve,reject)
}
MyPromise.prototype.then = function (onFulfilled,onRejected){
    if(this.status === 'resolve'){
        onFulfilled(this.value) //如果已经resolve直接执行onFulfilled
    }
    if(this.status === 'reject'){
        onRejected(this.reason) // 如果已经reject，直接执行onRejected
    }
    if (this.status === 'pending') { // 如果正在pending，暂存onFulfilled与onRejected，在resolve与reject函数被调用时再执行
        this.onResolvedCallbacks.push( ()=> {
            onFulfilled(this.value);
        });
        this.onRejectedCallbacks.push( ()=> {
            onRejected(this.reason);
        });
    }
}
```
用一个例子来试一下我们的MyPromise
```javascript
new MyPromise((resolve,reject)=>{
    setTimeout(() => {
        resolve(1000)
    }, 1000)
}).then(val=>{
    console.log(val, 'done1')
})
```
一切运行良好，但是这种实现不支持链式调用与promise值穿透，比如这样写就不行了。
```javascript
new MyPromise((resolve,reject)=>{
    setTimeout(() => {
        resolve(1000)
    }, 1000)
}).then(val=>{
    console.log(val, 'done1')
}).then(()=>{
    console.log('done2')
})
```
# 支持链式调用的promise
其实promise链式调用的实现很简单，给then方法默认返回一个promise即可。
```javascript
MyPromise.prototype.then = function (onFulfilled,onRejected){
    return new MyPromise((resolve,reject)=>{ //then方法默认返回一个promise，这样就能链式调用了
        if(this.status === 'resolve'){
            try{
                const x = onFulfilled(this.value) 
                if(x instanceof MyPromise){ //如果onFulfilled或onRejected返回一个promise，则需要等这个promise resolve或者reject了then方法返回的promise才会resolve或reject，这边是promise的值穿透功能。下同。
                    x.then(resolve,reject)
                }
                else{
                    resolve(x)
                }   
            } catch (e){
                reject(e)
            }
        }
        if(this.status === 'reject'){
            try{
                const x = onRejected(this.value)
                if(x instanceof MyPromise){
                    x.then(resolve,reject)
                }
                else{
                    resolve(x)
                }
            } catch (e){
                reject(e)
            }
        }
        if(this.status === 'pending'){
            this.onResolvedCallbacks.push(()=>{
                try{
                    const x = onFulfilled(this.value)
                    if(x instanceof MyPromise){
                        x.then(resolve,reject)
                    }
                    else{
                        resolve(x)
                    }
                } catch (e){
                    reject(e)
                }
            })
            this.onRejectedCallbacks.push(()=>{
                try{
                    const x = onRejected(this.reason)
                    if(x instanceof MyPromise){
                        x.then(resolve,reject)
                    }
                    else{
                        resolve(x)
                    }
                } catch (e){
                    reject(e)
                }
            }) 
        }
    })
}
```
