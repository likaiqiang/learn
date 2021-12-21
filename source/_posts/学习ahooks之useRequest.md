---
title: 学习ahooks之useRequest
date: 2021-12-03 22:07:27
tags:
---
# 前言
ahooks算是react hooks生态库重要的一环，其中useRequest算是使用比较多的hooks。（试问哪个前端页面没有http请求）
# useRequest的自我介绍
useRequest 是一个强大的异步数据管理的 Hooks，React 项目中的网络请求场景使用 useRequest 就够了。

useRequest 通过插件式组织代码，核心代码极其简单，并且可以很方便的扩展出更高级的功能。目前已有能力包括....

主要是第二句：useRequest的核心代码很简单，其他什么防抖、节流都是通过插件实现的。
# 代码分层
带着上一节的官方介绍来看useRequest的代码分层
[入口文件](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/useRequest.ts)

```typescript
function useRequest<TData, TParams extends any[]>(
  service: Service<TData, TParams>,
  options?: Options<TData, TParams>,
  plugins?: Plugin<TData, TParams>[],
) {
  return useRequestImplement<TData, TParams>(service, options, [
    ...(plugins || []),
    useDebouncePlugin,
    useLoadingDelayPlugin,
    usePollingPlugin,
    useRefreshOnWindowFocusPlugin,
    useThrottlePlugin,
    useRefreshDeps,
    useCachePlugin,
    useRetryPlugin,
    useReadyPlugin,
  ] as Plugin<TData, TParams>[]);
}
```
useRequest接收service、options、plugin三个参数，随后又调用了useRequestImplement函数，参数为service、options，plugins变成自定义plugins与内置plugins的集合。

其中service是一个返回promise的函数，也就是封装http request的函数。options则是一个参数大集合，除了 [base option](https://ahooks-next.surge.sh/zh-CN/hooks/use-request/basic#options) 以外，还包括内置插件的options。

从这里其实印证了官方的说法：useRequest的核心功能简单，其他的功能都是插件实现的（包括内置插件与自定义插件）。扒一扒useRequestImplement的源码，看看大佬所说的简单到底有多简单。

[useRequestImplement](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/useRequestImplement.ts#L12)

```typescript
function useRequestImplement<TData, TParams extends any[]>(
  service: Service<TData, TParams>,
  options: Options<TData, TParams> = {},
  plugins: Plugin<TData, TParams>[] = [],
) {
  const { manual = false, ...rest } = options;

  const fetchOptions = {
    manual,
    ...rest,
  };  //这两句挺费解的，其实可以更简 const fetchOptions = {manual:false,...options}

  const serviceRef = useLatest(service); //第一个旁支useLatest。

  const update = useUpdate(); // 第二个旁支

  const fetchInstance = useCreation(() => {
    const initState = plugins.map((p) => p?.onInit?.(fetchOptions)).filter(Boolean);
    // 第六个旁支
    return new Fetch<TData, TParams>(
      serviceRef,
      fetchOptions,
      update,
      Object.assign({}, ...initState),
    );
  }, []); // useCreation第三个旁支
  fetchInstance.options = fetchOptions;
  // run all plugins hook
  fetchInstance.pluginImpls = plugins.map((p) => p(fetchInstance, fetchOptions)); // 从这一句可以推出每个插件都是一个接收fetchInstance与fetchOptions的函数。
    // 执行所有的插件，并把结果存到fetchInstance.pluginImpls上

  useMount(() => { // 第四个旁支
    if (!manual) {
      // useCachePlugin can set fetchInstance.state.params from cache when init
      const params = fetchInstance.state.params || options.defaultParams || [];
      // @ts-ignore
      fetchInstance.run(...params);
    }
  });

  useUnmount(() => { // 第五个旁支
    fetchInstance.cancel();
  });

  return {
    loading: fetchInstance.state.loading,
    data: fetchInstance.state.data,
    error: fetchInstance.state.error,
    params: fetchInstance.state.params || [],
    cancel: useMemoizedFn(fetchInstance.cancel.bind(fetchInstance)),
    refresh: useMemoizedFn(fetchInstance.refresh.bind(fetchInstance)),
    refreshAsync: useMemoizedFn(fetchInstance.refreshAsync.bind(fetchInstance)),
    run: useMemoizedFn(fetchInstance.run.bind(fetchInstance)),
    runAsync: useMemoizedFn(fetchInstance.runAsync.bind(fetchInstance)),
    mutate: useMemoizedFn(fetchInstance.mutate.bind(fetchInstance)),
  } as Result<TData, TParams>;
}// 第七个旁支useMemoizedFn
```
上面一波粗略的阅读虽然遇到了6个旁支，但是根据变量的命名以及官方文档我们可以猜一猜useRequestImplement都干了什么事。

[useLatest](https://ahooks-next.surge.sh/zh-CN/hooks/use-latest)
[useUpdate](https://ahooks-next.surge.sh/zh-CN/hooks/use-update)
[useCreation](https://ahooks-next.surge.sh/zh-CN/hooks/use-creation)
[useMount](https://ahooks-next.surge.sh/zh-CN/hooks/use-mount)
[useUnmount](https://ahooks-next.surge.sh/zh-CN/hooks/use-unmount)
[useMemoizedFn](https://ahooks-next.surge.sh/zh-CN/hooks/use-memoized-fn)

通过文档可以看出useLatest的作用是返回某个参数的最新值，useCreation的作用是使某个值保持绝对不变（除非依赖发生变化）,useMemoizedFn的作用是使函数的地址永远不变。这三个都属于性能优化hook，对于我们理解useRequest可以暂时忽略。

而useUpdate，顾名思义，返回一个强制刷新的函数，用于整个组件树重新渲染。

useMount与useUnmount属于生命周期hook，分别在组件挂载与卸载时触发。

综上，useRequestImplement做的事其实就是，通过new Fetch生成一个fetchInstance实例，参数除了serviceRef、fetchOptions、update外，还有initState。瞅一眼initState。
```typescript
const initState = plugins.map((p) => p?.onInit?.(fetchOptions)).filter(Boolean);
```
```typescript
export type Plugin<TData, TParams extends any[]> = {
  (fetchInstance: Fetch<TData, TParams>, options: Options<TData, TParams>): PluginReturn<
    TData,
    TParams
  >;
  onInit?: (options: Options<TData, TParams>) => Partial<FetchState<TData, TParams>>;
};
```
从这两处可以看出每个plugin都可以有个onInit函数，返回值是部分FetchState对象，这个对象的集合就是initState。 瞅一眼Fetch的构造函数。
```typescript
constructor(
    public serviceRef: MutableRefObject<Service<TData, TParams>>,
    public options: Options<TData, TParams>,
    public subscribe: Subscribe,
    public initState: Partial<FetchState<TData, TParams>> = {},
  ) {
    this.state = {
      ...this.state,
      loading: !options.manual,
      ...initState,
    };
  }
```
可以看出，onInit的作用其实就是在初始化fetchInstance时，通过插件的形式生成initState，initState会在new Fetch时作为state的默认值。

回到主线，生成fetchInstance实例后，会在fetchInstance上放一些东西。
```typescript
fetchInstance.options = fetchOptions;
  // run all plugins hooks
fetchInstance.pluginImpls = plugins.map((p) => p(fetchInstance, fetchOptions)); // 从这一句可以推出每个插件都是一个接收fetchInstance与fetchOptions的函数。
// 执行所有的插件，并把结果存到fetchInstance.pluginImpls上
```
[PluginReturn](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/types.ts#L16)

pluginImpls其实就是一个含有onBefore、onRequest...等生命周期函数的对象集合。而这些生命周期就是插件系统的灵魂。Fetch内部通过一个叫runPluginHandler的函数调用各个插件（pluginImpls）。

大概瞅一眼[runPluginHandler](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L37) 的实现
```typescript
runPluginHandler(event: keyof PluginReturn<TData, TParams>, ...rest: any[]) {
    const r = this.pluginImpls.map((i) => i[event]?.(...rest)).filter(Boolean);
    return Object.assign({}, ...r);
}
```
我们看Fetch内部都在什么时机调用runPluginHandler。

[runAsync](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L43)
[cancel](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L136)
[mutate](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L155)

runAsync方法会在请求的各个阶段调用runPluginHandler（请求前/中/后...），onBefore/onRequest/onSuccess...，而这些钩子函数或者直接干预runAsync的执行，或者通过返回[约定的值](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/types.ts#L16) 来干预runAsync的执行。

总的来说，所谓的插件就是一个返回PluginReturn的函数，而PluginReturn中的各个生命周期函数会在Fetch的关键方法执行时调用。

这就是插件的工作原理，我们也可以写插件来执行上述过程。

回到主线。在组件挂载时执行fetchInstance.run()（假设manual为false），组件卸载时执行fetchInstance.cancel()，然后返回一大堆fetchInstance的属性/方法。

# 旁支
## Fetch类
用面向对象的思维封装了useRequest关于网络请求的几个api，在这里插一句话，我以前不重视面向对象那一套东西，其实在某些场景下，面向对象的可封装性与代码的可读性是优于函数式编程的，配合typescript的类型系统写起来不要太爽。

Fetch洋洋洒洒150+代码，从run函数开刀。
```typescript
 run(...params: TParams) {
    this.runAsync(...params).catch((error) => {
        if (!this.options.onError) {
            console.error(error);
        }
    });
}
```
run函数调用了runAsync函数。那run与runAsync有啥区别呢，文档是这样写的。
![65b965bf-b6f8-4928-a641-0b986ccc5274-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/65b965bf-b6f8-4928-a641-0b986ccc5274-image.png)
这句话具有误导作用，runAsync本质上是个async函数.
[onSuccess](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L94)
[resolve](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L103)
[onError](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L115)
[reject](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L124)
代码很清晰，run调用了runAsync,后者在执行过程中不管是options里面的success/error，还是promise形式的resolve/reject都会执行。

而整个runAsync的执行过程分为三部分，请求前/中/后。

请求前：
```typescript
this.count += 1;
const currentCount = this.count;

const {
  stopNow = false,
  returnNow = false,
  ...state
} = this.runPluginHandler('onBefore', params);

// stop request
if (stopNow) {
  return new Promise(() => {});
}

this.setState({
  loading: true,
  params,
  ...state,
});

// return now
if (returnNow) {
  return Promise.resolve(state.data);
}

this.options.onBefore?.(params);
```
可以先忽略那个奇怪的count，还是挺简单的，先是调用了所有插件的onBefore钩子。如果stopNow === true，返回一个空的promise，否则调用setState设置params和loading，这里的setState和react的setState是雷锋和雷峰塔的关系。
[setState](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L29)

```typescript
setState(s: Partial<FetchState<TData, TParams>> = {}) {
    this.state = {
        ...this.state,
        ...s,
    };
    this.subscribe();
}
```
调用了一个奇怪的subscribe函数，这个subscribe就是Fetch实例化时传入的update函数（useUpdate），目的是使组件rerender，让react组件拿到最新的Fetch成员变量。

回到runAsync主线。如果returnNow === true，返回空的promise，与前一步骤不同的是，这时的loading是true。然后调用options的onBefore函数，说明插件的onBefore是先于options.onBefore执行的，并且可以干预是否执行options.onBefore。

请求中与请求后分别对应try/catch代码块，暂且忽略count，先调用插件的onRequest钩子，请求可以在插件中发起，假如插件没有返回servicePromise或者没有请求，runAsync会自己执行server，请求完成以后设置state，调用options.onSuccess，插件的onSuccess钩子，options.onFinally。

请求后与请求中思路类似，就不重复了。回过头来看那个count发现除了runAsync，cancel也访问了count，从这里大概能猜到，runAsync中之所以有那么多currentCount与count的比对，目的就是检测请求有没有被取消（并不会真正的取消那条请求）

剩下的refresh、refreshAsync与mutate，前两个就不说了，来看[mutate](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L155) 的实现。
```typescript
let targetData: TData | undefined;
if (typeof data === 'function') {
  // @ts-ignore
  targetData = data(this.state.data);
} else {
  targetData = data;
}

this.runPluginHandler('onMutate', targetData);

this.setState({
  data: targetData,
});
```
代码很清晰，所做的事就是不调用server直接setState(data)，顺便调用插件的onMutate钩子，从代码来看，data还可以是个函数。

## hooks
### useLatest
[useLatest](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useLatest/index.ts)
简简单单几行代码，道不出这个hooks的真谛，我们来看官方[例子](https://ahooks-next.surge.sh/zh-CN/hooks/use-latest) 。
```typescript
import React, { useState, useEffect } from 'react';
import { useLatest } from 'ahooks';

export default () => {
  const [count, setCount] = useState(0);

  const latestCountRef = useLatest(count);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(latestCountRef.current + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <p>count: {count}</p>
    </>
  );
};
```
把useLatest去掉
```typescript jsx
import React, { useState, useEffect } from 'react';
import { useLatest } from 'ahooks';

export default () => {
  const [count, setCount] = useState(0);

  // const latestCountRef = useLatest(count);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(count+1)
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <p>count: {count}</p>
    </>
  );
};
```
可以自己用codesanbox运行运行一下这段代码，会发现jsx中count的值永远都是1。为什么会这样呢？这是因为每次setInterval在触发回调时，这个回调函数的地址都是一样的，也就是说每次调用的回调函数都是同一个，一旦函数唯一，该函数在创建时拥有的闭包就唯一，而count在每次rerender时都会重新生成，所以储存在setInterval函数闭包里的count永远都是第一次的count。

稍微改一点代码，验证一下这个过程。
```typescript jsx
useEffect(() => {
const func = ()=>{
  console.log('count',count)
  setCount(count+1)
}
func.time = new Date().getTime()
const interval = setInterval(() => {
  console.log(func.time)
  func()
}, 1000);
return () => clearInterval(interval);
}, []);
```
每次输出的func.time都是同一个值，count也是同一个值。这就验证了上述函数唯一，闭包唯一的结论。

那怎么才能让代码正常运行呢？有两种解决方案：
1. 函数不唯一。
2. 函数唯一，但是闭包里的count是不可变的。

第一种方案：
```typescript jsx
useEffect(() => {
    const func = ()=>{
      console.log('count',count)
      setCount(count+1)
    }
    func.time = new Date().getTime()
    const interval = setInterval(() => {
      console.log(func.time)
      func()
    }, 1000);
    return () => {
      console.log('unbind')
      clearInterval(interval);
    }
  }, [count]);
```
看起来挺好的，只需要改变一些useEffect的依赖，但是从log可以看出，会不停的输出unbind，所以这种方式是通过不停的unbind/bind的方式来实现函数的不唯一，这就不好了。

第二种方案：
```typescript jsx
export default () => {
  const [count, setCount] = useState(0);

  const latesCount = useRef(count)
  latesCount.current = count
  useEffect(() => {
    const func = ()=>{
      console.log('count',count)
      setCount(latesCount.current+1)
    }
    func.time = new Date().getTime()
    const interval = setInterval(() => {
      console.log(func.time)
      func()
    }, 1000);
    return () => {
      console.log('unbind')
      clearInterval(interval);
    }
  }, []);

  return (
    <>
      <p>count: {count}</p>
    </>
  );
};
```
从log可以看出func唯一，func中的count也唯一，但是jsx中的count会持续的增加。这是因为setCount的第一个参数不再是func闭包中不变的count，而是latesCount.current。
### useMemoizedFn
[官方例子](https://ahooks-next.surge.sh/zh-CN/hooks/use-memoized-fn)

为什么存在这个hook，useCallback又有什么缺点。为什么要保证函数的地址永远不变，举个例子来看一看这个问题。
```typescript jsx
import React, { useState, useCallback } from 'react';
import { useLatest } from 'ahooks';

export default () => {
  const [count, setCount] = useState(0);


  // const latestCountRef = useLatest(count);

  const onClickHandler = useCallback(()=>{
    setCount(count + 1)
  },[count])

  return (
    <>
      <p>{count}</p>
      <button onClick={onClickHandler}>add count</button>
      <Child/>
    </>
  );
};


const Child = (props)=>{
  console.log('child render')
  return (
    <div>我是child</div>
  )
}
```
每次点击add count button，Child组件都会rerender，万一Child组件很大，或者嵌套层次很深呢，这无疑带来了巨大的性能问题。

用React.memo包一下会好一点。
```typescript jsx
const Child = React.memo((props)=>{
  console.log('child render')
  return (
    <div>我是child</div>
  )
})
```
这样点击add count button，Child组件就不渲染了。但是React.momo在props变化时还是会rerender，代码改成这样。
```typescript jsx
export default () => {
  const [count, setCount] = useState(0);


  // const latestCountRef = useLatest(count);

  const onClickHandler = useCallback(()=>{
    setCount(count + 1)
  },[count])

  return (
    <>
      <p>{count}</p>
      <button onClick={onClickHandler}>add count</button>
      <Child func={onClickHandler}/>
    </>
  );
};


const Child = React.memo((props)=>{
  console.log('child render')
  return (
    <div>我是child</div>
  )
})
```
可以发现点击add count button，Child组件竟然重新渲染了，由此可见，每次setCount，onClickHandler都会指向一个新的函数地址。怎么规避呢，来看一看useMemoizedFn的实现。

[useMemoizedFn](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useMemoizedFn/index.ts)
```typescript jsx
function useMemoizedFn<T extends noop>(fn: T) {
  if (process.env.NODE_ENV === 'development') {
    if (typeof fn !== 'function') {
      console.error(`useMemoizedFn expected parameter is a function, got ${typeof fn}`);
    }
  }

  const fnRef = useRef<T>(fn);

  // why not write `fnRef.current = fn`?
  // https://github.com/alibaba/hooks/issues/728
  fnRef.current = useMemo(() => fn, [fn]);

  const memoizedFn = useRef<T>();
  if (!memoizedFn.current) {
    memoizedFn.current = function (...args) {
      // eslint-disable-next-line @typescript-eslint/no-invalid-this
      return fnRef.current.apply(this, args);
    } as T;
  }

  return memoizedFn.current;
}
```
useMemoizedFn本质上是个高阶函数。有两个useRef，一个存储变化的fn，一个存储永远不变的memoizedFn，调用useMemoizedFn时真正调用的是memoizedFn，然后在memoizedFn内部调用最新的fn。高阶函数的思路。

### useCreation
### useUpdate
### useMount
### useUnmount

# 插件
## 内置插件
### useDebouncePlugin
[useDebouncePlugin](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/plugins/useDebouncePlugin.ts)
大致看一下代码，发现核心实现是调了lodash的debounce方法，那为什么不直接用lodash，究其原因，还要从debounce的原理说起。

[debounce](https://github.com/lodash/lodash/blob/master/debounce.js)
这东西真反直觉，debounce本质上是个高阶函数，你传一个func函数，它给你返回一个debounced函数，至于剩下的那些lastArgs、lastThis...变量，全存在debounced函数的闭包中，所以保持debounced的唯一（闭包唯一）是重中之重。看一个非react的例子。

[vue debounce](https://cn.vuejs.org/v2/guide/computed.html#%E4%BE%A6%E5%90%AC%E5%99%A8)
created时在this上放了一个debouncedGetAnswer函数，就是为了保持debounced的闭包唯一。

所以不论是这里的useDebouncePlugin还是单独的useDebounceFn，所做的事都是让debounced函数在组件多次渲染中保持唯一。
## 自定义插件


