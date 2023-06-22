---
title: 学习rxjs
date: 2023-04-27 22:45:48
tags:
---
# 什么是rxjs
首先看什么是rxjs，chartgpt是这么回答的: 

RxJS是一种JavaScript库，它提供了一种用于处理异步数据流的编程模型。RxJS基于响应式编程概念，可以帮助开发人员更轻松地管理和操作复杂的异步数据流，并提供了丰富的操作符和工具，以便更好地处理这些数据流。

RxJS可以与许多不同类型的应用程序和框架一起使用，包括Angular、React、Vue等。它已成为现代Web应用程序中非常流行的一部分，并且在处理大量异步数据时非常有用。

这种非常官方的解释往往概念性很强，没有实用性。其实，在rxjs的眼里，不管是同步的还是异步的操作，都能抽象成流，可以用Observable new一条流，也可以用of、interval等函数（发射器）创造一条流，也可以把传统的操作转换成流，比如fromEvent、fromPromise、from。

一条流就是一个Observable对象，流就像河流一样是动的，不然就是一潭死水，河流里流淌的是河水，由rxjs创造出的流里面流淌的是各种数据，这些数据可以是连续的，也可以是不连续的，就像河流一样可以断流。

河流也是分上下游的，下游可以对上游流过来的“水”做各种加工，这种可以加工“水”的函数叫做操作符，最后作为消费者可以拿到最后的“水”，当然有的“水”是源源不断的，有的“水”是可以结束的，结束也分为正常结束和异常结束，一条流只能从流淌中变成正常结束，或者异常结束。

这就是我对rxjs的通俗解释。

# 一个实用的例子
假如有这样一个需求，有一个搜索框，在用户输入关键字时实时的调用search接口，最后把结果显示成一个列表。

这个需求肯定要用到函数去抖，不然不仅体验不好，服务端也扛不住，当然用传统技术栈这个功能也能完成，没有什么需求是必须使用某个技术栈才能完成，但是要是理解流的概念，用rxjs简直不要太丝滑。
```javascript
const SearchBar = ()=>{
    const inputRef = useRef();
    useEffect(()=>{
        fromEvent(inputRef.current, "input") //首先把用户在搜索框输入关键字的过程转换成一条流
            .pipe(
                debounceTime(300), //操作符函数去抖
                distinctUntilChanged(), // 这个操作符会对上游过来的数据进行比对，如果本次数据与上一次数据不一样，才会放行
                switchMap(() => //这个switchMap暂且理解为map（前期为了方便，其实switchMap与map区别很大），map嘛，原生js数组就有map方法，顾名思义，即为映射，这里便是把上游用户输入的关键字映射为一个一个的http请求
                    fetch(
                        "https://example.com/search"
                    )
                ),
                mergeMap((res) => res.json()) //这个暂且省略
            )
            .subscribe({
                next(list) {
                    console.log("list", list);// 订阅这个流，拿到结果，更新ui
                }
            });
    },[])
    return (
        <div>
            <input type="text" ref={inputRef} />
        </div>
    );
}
```
要理解rxjs各个操作符都干了什么事，学会看弹珠图是必备的，这里不介绍如何看弹珠图，这东西很直观不需要解释，不过我推荐一个弹珠图[网站](https://rxmarbles.com/) 。

回到上面的例子，上面的switchMap与mergeMap我解释的比较模糊，这里举个例子再次说明。先忽略这两个操作符，用最直白的map操作符实现同样的功能，看会出现什么问题。
```javascript
const SearchBar = ()=>{
    const inputRef = useRef();
    useEffect(()=>{
        fromEvent(inputRef.current, "input")
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                map(() => 
                    fetch(
                        "https://example.com/search"
                    )
                )
            )
            .subscribe({
                next(list) {
                    console.log("list", list);
                }
            });
    },[])
    return (
        <div>
            <input type="text" ref={inputRef} />
        </div>
    );
}
```
这样写订阅者最后拿到的是一个一个的promise，这样肯定不行。改一些代码：
```javascript
//...
fromEvent(inputRef.current, "input") 
    .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        map(() => 
            from( //新增
                fetch(
                    "https://example.com/search"
                )
            )
        )
    )
    .subscribe({
        next(list) {
            console.log("list", list);
        }
    });
//...
```
新加的from把promise转换成observable，这样写订阅者最后拿到的是一个个的observable，这样也不行，当然你可以这样改:
```javascript
fromEvent(inputRef.current, "input") 
    .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        map(() => 
            from( //新增
                fetch(
                    "https://example.com/search"
                )
            )
        )
    )
    .subscribe({
        next(list) {
            list.subscribe({
                next: console.log //新增
            })
        }
    });
```
这样非常麻烦的解决了问题，有没有简单的办法，当然有，那就是mergeMap，这个操作符可以把map产生的多个observable合并成一个，所以说，这个操作符合并的是observable，如果输入的不是observable，会先转成observable。所以mergeMap代码可以这样写
```javascript
fromEvent(inputRef.current, "input") 
    .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        mergeMap(() =>
            fetch(
                "https://example.com/search"
            )
        )
    )
    .subscribe({
        next: console.log
    });
```
这样写，确实解决了多个observable的问题，但是next拿到的数据是一个fetch response，fetch的response需要执行response.json()，这样才能拿到真实的数据，而response.json()返回的是一个promise，看到没有又回到了熟悉的问题，所以上面的代码在mergeMap之后还需要跟一个mergeMap
```javascript
mergeMap(() =>
    fetch(
        "https://example.com/search"
    )
),
mergeMap(res=>res.json())
```
这样就解决了问题，细心的你可能会发现，在最初的例子里第一个mergeMap用的是switchMap，这俩有啥区别呢？通俗的说，当前一个fetch还没有resolve时，来了一个新的fetch，switchMap会取消未完成的fetch，只关注最新的请求，而mergeMap则没有这种特性。
# 订阅与退订
先来一个简单的例子

```javascript
const source$ = new Observable(obs=>{
    let count = 0
    const timerid = setInterval(()=>{
        obs.next(count++)
        if(count > 10){
            obs.complete()
        }
    },1000)
    return ()=>{ //标记1
        clearInterval(timerid)
    }
})
const subscribe = source$.subscribe({
    next: console.log
})
setTimeout(()=>{
    subscribe.unsubscribe()
},2000)
```
首先我通过new Observable 创造了一个source$，这个source$是冷启动的，然后执行source$.subscribe(订阅)，由于这个流是冷启动的，所以执行subscribe方法就相当于重新执行Observable的回调函数，最后在两秒后执行退订操作，一旦我们unsubscribe，就会执行标记1，除了主动unsubscribe，当一个流complete/error时也会执行标记1
# 热启动与冷启动
假如我们去看电影，可以选择线上或者线下，去线上看，每个人都独享一个播放器，每来一个人电影都是从头开始播放的，这就是冷启动。但是换成线下，比如去电影院，电影已经开始了，中途来了一些人，这时电影不可能从头播放，新人只能接着看，这就是热启动，用代码表示，还是刚才的例子。

```javascript
const source$ = new Observable(obs=>{
    console.log('start')
    let count = 0
    const timerid = setInterval(()=>{
        obs.next(count++)
        if(count > 10){
            obs.complete()
        }
    },1000)
    return ()=>{ //标记1
        console.log('termdowwn')
        clearInterval(timerid)
    }
})
source$.subscribe({
    next: console.log
})
setTimeout(()=>{
    source$.subscribe({
        next: console.log
    })
},2000)
```
上述代码的source$是冷启动的，因为通过new Observable创建的流都是冷启动的，执行结果:

![15d929d7-5bfc-43c6-9770-fbc8a97beb67-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/15d929d7-5bfc-43c6-9770-fbc8a97beb67-image.png)

我们可以用share操作符，把这个流转换成热启动的

```javascript
const source$ = new Observable(obs=>{
    console.log('start')
    let count = 0
    const timerid = setInterval(()=>{
        obs.next(count++)
        if(count > 10){
            obs.complete()
        }
    },1000)
    return ()=>{ //标记1
        console.log('termdowwn')
        clearInterval(timerid)
    }
}).pipe(
    share() //新增
)
source$.subscribe({
    next: console.log
})
setTimeout(()=>{
    source$.subscribe({
        next: console.log
    })
},2000)
```
![e477044e-adc8-4ee7-a73a-7a47490c5941-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/e477044e-adc8-4ee7-a73a-7a47490c5941-image.png)

为什么要区分冷/热启动，主要是由使用场景决定的。
# creation function(发射器)

rxjs中有一些函数并不是操作符，这类函数能直接创造出observable对象，比如of、interval、timer、from、fromEvent之类的，前三个就不说了，后两个可以把不是observable的数据转换成observable，比如from([1,2,3])、fromEvent(inputDom,'input')

# rxjs适用的场景
前面已经说过，rxjs主要是操作流的工具集，如果某个数据/操作不是流，需要先转换成流。简单的数据这样做是很麻烦的，假如我们要过滤某些数据，我们完全可以调用数组的filter方法，又比如有一个promise，如果用rxjs处理也很麻烦，一个最朴素的promise用法

```javascript
fetch('https://www.example.com').then(res=>res.json()).then(console.log)
```
用rxjs需要这样写
```javascript
from(
    fetch('https://www.example.com')
).pipe(
    mergeMap(res=>res.json())
).subscribe({
    next: console.log
})
```
其实这样简单的问题交给rxjs去处理，完全是高射炮打蚊子，那rxjs适合什么场景呢，我觉得主要有两个方面: 

1. rxjs适合那种可以<em style="font-weight:800">高频触发</em>的场景，比如上文中提到的实用的例子，像我们经常提到的去抖、节流之类的，在人家这就一个操作符的事。有人说rxjs可以用来处理复杂的异步，常见的异步直接上promise，或者Promise.all都能覆盖绝大多数场景，但是你有没有发现promise是有弊端的，像fetch-event-source或者websocket这类长连接，用promise会力不从心，这时候rxjs就可以大展神通，还可以用bufferCount或者bufferTime控制下游的压力，更复杂点的，假如页面上有多个长连接，也可以用rxjs。

来个大家都熟悉的例子，假如有这样一个场景，在2s内输入规定的按键，可以触发彩蛋操作，就像打游戏释放隐藏大招，这样一个需求代码怎么写，如果用rxjs不要太简单
```javascript
const code = [
   "ArrowUp",
   "ArrowUp",
   "ArrowDown",
   "ArrowDown",
   "ArrowLeft",
   "ArrowRight",
   "ArrowLeft",
   "ArrowRight",
   "KeyB",
   "KeyA",
   "KeyB",
   "KeyA"
]
Rx.Observable.fromEvent(document, 'keyup')
    .map(e => e.code)
    .bufferTime(2000)
    .filter(keys => keys.length === 12 && _.isEqual(last12key, code))
    .subscribe(() => {
        console.log('隐藏的彩蛋 \(^o^)/~')
    })
```
当然你通过监听document的keyup事件，然后计时也可以实现，不过你有没有发现用rxjs写完整个过程一气呵成，代码也很有语义，是别的方法难以比拟的。

2. 把数据/操作转换成流，可以蹭rxjs的操作符，假如有这样一个场景，用javascript上传一个大文件，要求实现分片上传与断点续传，用rxjs可以这样写: 

```javascript
function uploadChunk(buffer){
    return fetch('http://www.example/upload',{
        data: buffer,
        method: 'post'
    })
}

function uploadChunkFunc(buffer,index){
    return from(
        uploadChunk(buffer)
    ).pipe(
        mergeMap(()=>{
            return of(index)
        })
    )
}

const size = 1024 * 1024

function upload (file,uploadChunk = []){
    const chunk = []
    for(let i=0;i<file.byteLength.length;i+=size){
        chunk.push(file.slice(i, i + size))
    }
    return from(chunk).pipe(
        mergeMap((buffer,i)=>{
            if(uploadChunk.includes(i)) return of(i)
            return uploadChunkFunc(buffer,i)
        })
        .retryWhen(errors=>{
            return errors.pipe(delay(1000),takeWhile((_,index)=> index < 3))
        })
        .mergeMap((index)=>{
            if(!uploadChunk.includes(index)) {
                uploadChunk.push(index)
                return of(index)
            }
            if(uploadChunk.length === chunk.length) return EMPTY
            return upload(file, uploadChunk)
        })
    )
}
const file = new ArrayBuffer(10 * size)
upload(file).subscribe({
    next: console.log,
    complete: ()=>console.log('complete'),
    error: error=>console.log(error)
})
```
当然，用promise也可以完成这个需求，但是要实现错误重试并且把代码写的好一点还是rxjs好。
# rxjs操作符
如何灵活运用操作符，是rxjs的核心，但是我不想逐个介绍，知识应该是网状的。我决定找几个例子，尽量覆盖常用的操作符。

## 例子1(上面的两个例子)
命中的操作符: retryWhen、takeWhile、bufferTime、filter
### retryWhen
从上面的例子可以看出，retryWhen会拦截上游抛出的错误，这个操作符的参数是一个函数，并且这个函数必须return一个observable，这个函数的参数是上游出错的原始observable，就像上面的例子:
```javascript
//...
retryWhen(errors=>{
    return errors.pipe(delay(1000),takeWhile((_,index)=> index < 3))
})
//...
```
这里的errors就是上游出错的原始observable，所以可以继续pipe，这里延迟了1秒

# rxjs操作符
## 转换操作符
## 过滤操作符
## 组合操作符
## 多播操作符
## 错误处理操作符
## 错误处理操作符
## 工具操作符
## 条件和布尔操作符
## 数学和聚合操作符
## forkJoin
先看官方的解释：

Accepts an Array of ObservableInput or a dictionary Object of ObservableInput and returns an Observable that emits either an array of values in the exact same order as the passed array, or a dictionary of values in the same shape as the passed dictionary.

翻译成中文：这个函数接受一个ObservableInput类型的数组或一个ObservableInput类型的字典对象，然后返回一个Observable。这个Observable会按照传入的数组顺序发出值的数组，或者按照传入的字典对象的形状发出值的字典。简单来说，它可以将多个Observable合并成一个Observable，并且保持原有的数据结构不变。

通俗的讲，forkJoin是rxjs中的Promise.all，后者能完成的forkJoin都可以，而且也支持嵌套。

一个promise.all的简单场景
```javascript
Promise.all([
    fetch('https://example1.com'),
    fetch('https://example2.com'),
]).then(([res1,res2])=>{
    return Promise.all([res1.json(),res2.json()])
}).then(([res1,res2])=>{
    console.log(res1,res2)
})
```
用forkJoin这么写
```javascript
forkJoin(
    fetch('https://example1.com'),
    fetch('https://example2.com')
).pipe(
    mergeMap(([res1,res2])=>{
        return forkJoin(res1.json(),res2.json())
    })
).subscribe({
    next:([res1,res2])=>{
        console.log(res1,res2)
    }
})
```
从实际使用来看，forkJoin的参数如果不是ObservableInput类型，会调用from转换成一个ObservableInput，而且这种例子很明显Promise.all更简洁一点，不过rxjs支持teardown，所谓teardown就是在流完成、出错或者被退订时，提供了一个钩子，可以执行一些清理工作。
```javascript
const customFetch = (url)=>{
    return new Observable(obs=>{
        const controller = new AbortController()
        fetch(url,{
            signal: controller.signal
        }).then(res=>res.json()).then(obs.next).catch(obs.error)
        return ()=>{
            return controller.abort()
        }
    })
}
```
## combineLatest/merge/concat区别
本来想解释一下，后来发现看弹珠图更清晰。

[concat](https://rxmarbles.com/#concat)
[merge](https://rxmarbles.com/#merge)
[combineLatest](https://rxmarbles.com/#combineLatest)

concat是三者里面最简单的，有点类似数组的concat方法，剩下两个可以用我给的看弹珠图网站，自己玩玩，深刻体会一下。

//按照种类分类
## map
## mergeMap
## switchMap
## catchError

## bufferCount/bufferTime
