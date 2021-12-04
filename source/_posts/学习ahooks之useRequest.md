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
  // run all plugins hooks
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

通过文档可以看出useLatest的作用是返回某个参数的最新值，useCreation的作用是使某个值保持绝对不变（除非依赖发生变化）,useMemoizedFn的作用是使函数的地址永远不变。这三个都属于性能优化hooks，对于我们理解useRequest可以暂时忽略。

而useUpdate，顾名思义，返回一个强制刷新的函数，用于整个组件树重新渲染。

useMount与useUnmount属于生命周期hooks，分别在组件挂载与卸载时触发。

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

pluginImpls其实就是一个含有onBefore、onRequest...等生命周期函数的对象集合。而这些生命周期就是插件系统的灵魂。大概瞅一眼[runPluginHandler](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L37) 的实现
```typescript
runPluginHandler(event: keyof PluginReturn<TData, TParams>, ...rest: any[]) {
    const r = this.pluginImpls.map((i) => i[event]?.(...rest)).filter(Boolean);
    return Object.assign({}, ...r);
}
```
这句话其实挺费解的，我们看Fetch内部是怎么调用runPluginHandler的。

[runAsync](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L43)
[cancel](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L136)
[mutate](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/Fetch.ts#L155)

runAsync方法会在请求的各个阶段调用runPluginHandler（请求前/中/后...），onBefore/onRequest/onSuccess...，而这些钩子函数或者直接干预runAsync的执行，或者通过返回[约定的值](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useRequest/src/types.ts#L16) 来干预runAsync的执行。

这就是插件的工作原理，我们也可以写插件来执行上述过程。

回到主线。然后在组件挂载时执行fetchInstance.run()（假设manual为false），组件卸载时执行fetchInstance.cancel()，然后返回一大堆fetchInstance的属性/方法。

# 旁支
## hooks
## Fetch类
# 插件
## 内置插件
## 自定义插件


