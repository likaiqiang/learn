---
title: 学习baidu react-hooks
date: 2022-04-03 16:02:47
tags:
---
# useMethods
[文档](https://ecomfe.github.io/react-hooks/#/hook/methods/use-methods)

挺有用的一个封装。首先hooks真是react函数式编程的伟大胜利，为函数式编程带来了状态。其次，很多人觉得hooks有缺点，那就是每次setState组件都会重新render，其实这不完全是缺点，我们都知道使用useState会使组件render，而useRef却不会，只要我们写代码时能区分哪些是真正的state，哪些是ref，就能避开绝大多数不必要的render。

useMethod这个hook便遵循上面的规则，这个hook的作用是封装了业务中对数据模型的各种操作，不用写一大堆useState/useRef。回归到文档中的例子，如果不用useMethods，就会写出这么一堆代码。

```javascript
export default () => {

    const [user,changeUser] = useState({
        role: 'user', enabled: true, history: []
    })

    const methodsRef = useRef()
    if(!methodsRef.current){
        methodsRef.current = {
            asAdmin(user) {
                const copyUser = Object.assign({},{...user})
                copyUser.role = 'admin'
                copyUser.history.push('change to admin');
                changeUser(copyUser)
            },
            asUser(user) {
                const copyUser = Object.assign({},{...user})
                copyUser.role = 'user'
                copyUser.history.push('change to user');
                changeUser(copyUser)
            },
            enable(user) {
                const copyUser = Object.assign({},{...user})
                copyUser.enabled = true;
                copyUser.history.push('disabled');
                changeUser(copyUser)
            },
            disable(user) {
                const copyUser = Object.assign({},{...user})
                copyUser.enabled = false;
                copyUser.history.push('enabled');
                changeUser(copyUser)
            }
        }
    }


    return (
        <>
            <Row>
                <Col span={2}>
                    Admin: <Switch checked={user.role === 'admin'} onChange={()=>{
                        user.role === 'admin' ? methodsRef.current.asUser(user) : methodsRef.current.asAdmin(user)
                    }}/>
                </Col>
                <Col span={2}>
                    Enabled: <Switch checked={user.enabled} onChange={()=>{
                        user.enabled ? methodsRef.current.disable(user) : methodsRef.current.enable(user)
                    }} />
                </Col>
            </Row>
            <h3 style={{marginTop: 30}}>Mutation history:</h3>
            <ul>
                {user.history.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
        </>
    );
};
```
假如业务场景变了，又要写一大堆，其中许多还是重复的，useMethods就是针对这一情况做的封装。我们先尝试自己封装一个useMethods。

```javascript
const useMethods = (model,reducers)=>{
    const [state,setState] = useState(model)
    const methodsRef = useRef()
    if(!methodsRef.current){
        methodsRef.current = Object.keys(reducers).reduce((acc,key)=>{
            const fn = reducers[key]
            Object.assign(acc,{   // 利用高阶函数，函数内部调用了setState，并且执行了原始的fn。为什么不直接setState，而是要在它上面包一层，这样做是为了保证新的fn永远不变
              [key]: (...arg)=>{
                setState(s=>{
                  return fn(s,...arg)
                })
              }
            })
            return acc
        },{})
    }
    return [state,methodsRef.current]
}
```
然后只需要这样
```javascript
export default function App() {

  const [user,methods] = useMethods({
    role: 'user', enabled: true, history: []
  },{
    asAdmin(user) {
        const copyUser = Object.assign({},{...user})
        copyUser.role = 'admin'
        copyUser.history.push('change to admin');
        return copyUser
    },
    asUser(user) {
        const copyUser = Object.assign({},{...user})
        copyUser.role = 'user'
        copyUser.history.push('change to user');
        return copyUser
    },
    enable(user) {
        const copyUser = Object.assign({},{...user})
        copyUser.enabled = true;
        copyUser.history.push('disabled');
        return copyUser
    },
    disable(user) {
        const copyUser = Object.assign({},{...user})
        copyUser.enabled = false;
        copyUser.history.push('enabled');
        return copyUser
    }
  })
  return (
        <>
            <Row>
                <Col span={2}>
                    Admin: <Switch checked={user.role === 'admin'} onChange={user.role === 'admin' ? methods.asUser : methods.asAdmin}/>
                </Col>
                <Col span={2}>
                    Enabled: <Switch checked={user.enabled} onChange={user.enabled ? methods.disable : methods.enable}/>
                </Col>
            </Row>
            <h3 style={{marginTop: 30}}>Mutation history:</h3>
            <ul>
                {user.history.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
        </>
    );
}
```
和文档中的例子用法差不多，略有不同。我们都知道react中数据是不可变的，如果你的model是复杂的数据，更新起来会很麻烦，有一个库叫做[use-immer](https://github.com/immerjs/use-immer)，可以上github看看它的用法，挺好用的，和useState的区别，可以看[这里](https://stackoverflow.com/questions/61669930/whats-the-difference-between-usestate-and-useimmer)

了解了上面一大堆，再来看useMethodsNative[源码](https://github.com/ecomfe/react-hooks/blob/master/packages/methods/src/native.ts)。

忽略typescript，发现与我们自己实现的useMethods差不多，但是为啥叫useMethodsNative，native即原生的，也就是使用useState更新数据，而大多数情况下我们的model都是复杂数据，所以推荐使用[useMethods](https://github.com/ecomfe/react-hooks/blob/master/packages/methods/src/immer.ts)。

# useBoolean/useSwitch/useSwitch

如果理解了useMethods/useMethodsNative，这三个封装完全是useMethodsNative的快捷方式。

我们来看看文档中useBoolean的例子直接使用useMethods应该怎么写。

```javascript
const useMethods = (model,reducers)=>{ // 下文如果有用到useMethods，指的都是这个方法
    const [state,setState] = useImmer(model)
    const methodsRef = useRef()
    if(!methodsRef.current){
        methodsRef.current = Object.keys(reducers).reduce((acc,key)=>{
            const fn = reducers[key]
            Object.assign(acc,{
              [key]: (...arg)=>{
                setState(s=>{
                  return fn(s,...arg)
                })
              }
            })
            return acc
        },{})
    }
    return [state,methodsRef.current]
}

export default () => {
    const [value, {on, off, toggle}] = useMethods(false,{
        on() {
            return true;
        },
        off() {
            return false;
        },
        toggle(prevState, arg) {
            return typeof arg === 'boolean' ? arg : !prevState;
        },
    });
    return (
        <>
            <div>
                <Button className='button1' type="primary" onClick={on}>Switch On</Button>
                <Button className='button2' danger onClick={off}>Switch Off</Button>
                <Button className='button3' onClick={toggle}>Toggle Value</Button>
            </div>
            <div className='switch'>
                <p>Current value: <Switch checked={value} /></p>
            </div>
            
        </>
    )
};
```
封装一下，还是有好处的，假如多处使用，可以使代码变短。

# useArray/useSet/useMap

这仨也是useMethods的快捷方式。

# useActionPending

[文档](https://ecomfe.github.io/react-hooks/#/zh-CN/hook/action-pending/use-action-pending)

假如我们自己用useMethods写一个useActionPending应该怎么做。首先应该区分哪些是state，哪些是ref，pendingCount是state，waitTime是ref。同时还需要一个计数器来统计处于pending状态promise的个数。

```javascript
const useActionPending = (func)=>{
    const [count,{inc,dec}] = useMethods(0,{ //统计promise pending的计数器
        increment(state) {
            return Math.min(max, state + step);
        },
        decrement(state) {
            return Math.max(min, state - step);
        },
        inc(state) {
            return Math.min(max, state + step);
        },
        dec(state) {
            return Math.max(min, state - step);
        },
        reset(state, value = 0) {
            return value;
        }
    })
    const funcRef = useRef((...arg)=>{ // 封装func为ref
        inc()
        return func(...arg).then(()=>{
            dec()
        })
    })
    useEffect(()=>{
        funcRef.current = (...arg)=>{
            inc()
            return func(...arg).then(()=>{
                dec()
            })
        }
    },[func,inc,dec]) // 依赖虽然有inc/dec，但是根据useMethods内部实现，这俩都是ref，好巧妙的实现。
    return [funcRef.current,count]
}
```
差不多和源码的实现一致，最大的不同在于，调用dec时源码还判断了此时组件是否已经卸载，避免内存泄露。

# useInfiniteScroll
[文档](https://ecomfe.github.io/react-hooks/#/zh-CN/hook/infinite-scroll/use-infinite-scroll)

使用useMethods封装的无限滚动，需要配合react-infinite-scroll-component来使用,来看源码。

```javascript
export function useInfiniteScroll(fetch,options = {}) {
    const {initialLoad = false, initialItems = []} = options;
    const initialLoadStarted = useRef(false); // 由于react-infinite-scroll-component并不管第一屏的数据渲染，所以初始的数据必须超过一屏，否则loadMore不触发
    const initialLoadEnded = useRef(false); // 使用initialLoadStarted与initialLoadEnded分别表示第一次请求（第一屏的数据）是否已经开始请求/是否已经结束请求
    const [{pendingCount, dataSource, hasMore}, {requestStart, requestEnd}] = useMethods(
        {pendingCount: 0, dataSource: initialItems, hasMore: true},
        createContextReducers()
    ); // 使用useMethods封装核心逻辑，pendingCount表示处于pending状态的网络请求数，可以用来推出是否正在loading
    const loading = !!pendingCount;
    const loadMore = useCallback( // 
        async () => {
            if (loading) {
                return;
            }
            initialLoadStarted.current = true; //第一次请求开始
            requestStart();
            const response = await fetch({offset: dataSource.length});
            initialLoadEnded.current = true; // 第一次请求结束
            requestEnd(response);
        },
        [loading, requestStart, fetch, dataSource.length, requestEnd]
    );
    useEffect(
        () => {
            if (initialLoad && !initialLoadStarted.current) { //如果react-infinite-scroll-component已加载，并且第一次请求没有开始，执行loadMore
                loadMore();
            }
        },
        [initialLoad, loadMore]
    );

    return {
        dataSource,
        loadMore,
        hasMore,
        loading,
        initialLoading: initialLoad && !initialLoadEnded.current, //initialLoading表示第一次请求的状态
    };
}
```
# usePreviousValue
[文档](https://ecomfe.github.io/react-hooks/#/zh-CN/hook/previous-value/use-previous-value)

文档上说获取某个值的前一个值在某些时候是有用的，比如计算派生state。

```javascript
export function usePreviousValue<T>(value: T): T | undefined {
    const cache = useRef<T | undefined>(undefined);
    useEffect(
        () => {
            cache.current = value;
        },
        [value]
    );
    return cache.current;
}
```
实现的思路也是言简意赅。利用ref缓存value，但是在useEffect执行时才更新ref，所以每次usePreviousValue执行时返回的总是上一次的值。

# useDerivedState
[文档](https://ecomfe.github.io/react-hooks/#/zh-CN/hook/derived-state/use-derived-state)

文档上说是getDerivedStateFromProps的hook实现，对getDerivedStateFromProps不熟暂不做评价，看源码。

```typescript
export function useDerivedState<P, S = P>(
    propValue: P,
    compute: Derive<P, S> = v => v as unknown as S
): [S, Dispatch<SetStateAction<S>>] {
    const [previousPropValue, setPreviousPropValue] = useState(propValue); // 为啥起个名字叫previousxxx，因为根据hooks的特性，虽然每次render propValue的值可能会变，但如果不主动setPreviousPropValue，previousPropValue的值总是等于第一次propValue的值。
    const [value, setValue] = useState(() => compute(propValue, undefined)); // 计算出第一次的派生state

    if (previousPropValue !== propValue) { // 配合hook的更新特性可以检测出propValue是否改变
        setValue(state => compute(propValue, state)); // update derivedState
        setPreviousPropValue(propValue); // update previousvalue
    }

    return [value, setValue];
}
```
# useOriginalCopy
[文档](https://ecomfe.github.io/react-hooks/#/zh-CN/hook/previous-value/use-original-copy)

文档上说这个封装的意义在于：某些hooks像useEffect、useCallback都依赖dependency list中的值是否变化来更新，而dependency list的比较规则是引用相等。某些时候两个对象一模一样，但是它们的引用不相等，就会出问题。

文档中的例子不具有代表性，完全可以这样（mark）来实现功能。既然比较规则是引用相等，那就尽量比较值类型。

```javascript
export default () => {
    const [effectsCount, runEffect] = useReducer(v => v + 1, 0);
    const forceUpdate = useReducer(v => v + 1, 0)[1];
    // This is not memoized
    const value = {x: 1};
    // The original copy of value if retrieved on each render
    // const originalValue = useOriginalCopy(value);
    // originalValue will be reference equal on different render, effect runs only once
    // useEffect(
    //     () => {
    //         runEffect();
    //     },
    //     [originalValue]
    // );
    useEffect(
        () => {
            runEffect();
        },
        [originalValue.x] //mark
    );
    console.log(effectsCount);
    return (
        <div>
            <p style={{marginBottom:30}}>Effect run {effectsCount} times.</p>
            <Button type="primary" onClick={forceUpdate}>Force Update</Button>
        </div>
    );
};
```
我觉得大多数情况下不需要useOriginalCopy，可能某些情况下，为了避免状态分的太散，或者组件拆的太细，需要维护一些粒度较大的状态，才需要这些封装。来看源码。

```typescript
export function useOriginalCopy<T>(value: T, equals: CustomEquals<T> = shallowEquals): T {
    const cache = useRef<T>(value); // 思路借鉴了usePreviousValue
    const equalsRef = useRef(equals); //我觉得某些函数确定不在ui中使用，可以优先使用useCallback
    useEffect(
        () => {
            equalsRef.current = equals;
        },
        [equals]
    );
    useEffect(
        () => {
            if (!equalsRef.current(cache.current, value)) {
                cache.current = value;
            }
        },
        [value]
    );

    return equals(cache.current, value) ? cache.current : value; // 思路借鉴了usePreviousValue
}
```
第二个参数默认是浅比较，可以传deepEquals从而衍生出useOriginalDeepCopy。

# useEffectRef
[文檔](https://ecomfe.github.io/react-hooks/#/hook/effect-ref/use-effect-ref)

举个例子，我们用hooks写网页时，往往需要访问dom，通常会写出这样的代码。

```javascript
export default ()=>{
    const eleRef = useRef()
    useEffect(()=>{
        if(eleRef.current){
            //..... main
        }
    },[])
    return (
        <div ref={eleRef}>test</div>
    )
}
```
这样写main只会执行一次，无法在rerender时重新操作dom
```javascript
export default ()=>{
    return (
        <div ref={ref=>{
            if(ref){
                //.... main
            }
        }}>
            test
        </div>
    )
}
```
但是这样写有个缺点，虽然每次rerender main都会执行，但是我们既然在dom挂载时做了一些副作用，我们就应该在dom卸载时清除这些副作用，有点类似于vue directive。来看源码

```typescript
export function useEffectRef<E extends HTMLElement = HTMLElement>(callback: RefCallback<E>): EffectRef<E> {
    const disposeRef = useRef<(() => void)>(noop); // disposeRef用来存放cleanup function
    const effect = useCallback(
        (element: E | null) => {
            disposeRef.current(); // 每次callback变化（rerender）执行 cleanup function
            // To ensure every dispose function is called only once.
            disposeRef.current = noop;

            if (element) {
                const dispose = callback(element); // 安全起见，callback必须返回一个cleanup function

                if (typeof dispose === 'function') {
                    disposeRef.current = dispose;
                }
                // Have an extra type check to work with javascript.
                else if (dispose !== undefined) {
                    // eslint-disable-next-line no-console
                    console.warn('Effect ref callback must return undefined or a dispose function');
                }
            }
        },
        [callback]
    );

    return effect;
}
```
所以，我们只需要在代码里面这么写就ok了
```javascript
export default ()=>{
    const refFunc = useEffectRef(ele=>{
        // main
    })
    return (
        <div ref={refFunc}>
            test
        </div>
    )
}
```
# useMergedRef
[文档](https://ecomfe.github.io/react-hooks/#/hook/merged-ref/use-merged-ref)

顾名思义，合并ref。ref要么接收一个useRef，要么接收一个函数，但是往往为了代码的可读性，需要为ref绑定多个操作，这时我们就需要合并多个操作。思路也很简单，不管是useRef还是callback，都用高阶函数包起来，内部挨个执行它们。来看源码。

````typescript
import {useRef, Ref, RefCallback, MutableRefObject} from 'react';
import {usePreviousEquals} from '@huse/previous-value';

export type RefLike<T> = Ref<T> | null | undefined;

function arrayShallowEquals<T>(x: Array<RefLike<T>> | undefined, y: Array<RefLike<T>>) {
    if (x?.length !== y.length) {
        return false;
    }

    for (let i = 0; i < x.length; i++) {
        if (x[i] !== y[i]) {
            return false;
        }
    }

    return true;
}

function isCallbackRef<T>(ref: RefLike<T>): ref is RefCallback<T> {
    return typeof ref === 'function';
}

function mergeRefs<T>(refs: Array<RefLike<T>>): RefCallback<T> {
    // 返回一个函数用于ref的值，函数内部遍历refs数组，并且区分是否是函数，然后各自执行操作。
    return (value: T) => {
        for (const ref of refs) {
            if (isCallbackRef(ref)) {
                ref(value);
            }
            else if (ref) {
                // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31065
                (ref as MutableRefObject<T>).current = value;
            }
        }
    };
}

export function useMergedRef<T>(refs: Array<RefLike<T>>): RefCallback<T> {
    // To allow difference length of `ref` array, we need a loose version of `useCallback`
    const mergedCallbackRef = useRef<RefCallback<T> | undefined>(); // 由于useMergedRef的返回值仍然是个函数，函数本身的变化通常不引起uirender，所以应当用ref存储它。
    const areRefsEqual = usePreviousEquals(refs, arrayShallowEquals); // 为了提升性能，浅比对前后refs，如果相等，就读缓存，避免后续不必要的rerender。

    // The `!mergedCallbackRef.current` part is to "cheat" TypeScript.
    if (!areRefsEqual || !mergedCallbackRef.current) {
        mergedCallbackRef.current = mergeRefs(refs);
    }

    return mergedCallbackRef.current;
}
````
# useTransitionState
[文档](https://ecomfe.github.io/react-hooks/#/hook/transition-state/use-transition-state)

文档上的例子让我想起了toast组件，初看transitionState这个名字，我还以为是动画相关的什么封装。来看源码

[源码](https://github.com/ecomfe/react-hooks/blob/master/packages/transition-state/src/index.ts)

思路很像函数去抖，只不过在最后一个tick又执行了初始操作，即setValue(defaultValue)。看这段代码之前，我自己想了一下，这个需求如果是让我实现，该怎么写，结果我把setTimeout/clearTimeout的逻辑写到了setTransition里，细想一下，像setTimeout这种有副作用的方法还真应该放到useEffect里面。

不过我搞不懂，为啥setTransition 使用useCallback缓存，像这种与ui打交道又希望它不变的函数，不是推荐使用useRef嘛！

# useIntendedLazyValue
[文档](https://ecomfe.github.io/react-hooks/#/hook/intended-lazy/use-intended-lazy-value)

我猜这个hook的意义在于：有时候我们需要在组件A中获取某个实时变化的值（不是实时获取），由于不是实时获取所以这个值的变化带来的rerender组件A并不需要，所以我们便不能把这个值当做参数传给组件B，好的思路是传个引用稳定的function（就叫getValue），并且保证只在commit阶段调用getValue。

```typescript
export function useIntendedLazyValue<T>(value: T): () => T {
    const ref = useRef(value);
    useImperativeHandle(ref, () => value); // 如果不是为了保证只在commit阶段调用getValue，这一句完全可以换为ref.current = value
    const stableGet = useRef(() => ref.current);
    return stableGet.current;
}
```
# useIntendedLazyCallback
从源码来看，是useIntendedLazyValue的函数版本，即useIntendedLazyValue的参数是一个函数。使用场景倒是挺有用的，即保持一个函数的引用稳定，有点像[useMemoizedFn](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useMemoizedFn/index.ts)

# useRenderTimes
很简单，略。
# useChangeTimes
源码比上一个多几行，通过usePreviousValue比对当前值与上一次的值是否相同，如果不同并且组件已经mounted，计数器加一。debug时挺有用的。
# useUpdateCause
[文档](https://ecomfe.github.io/react-hooks/#/hook/debug/use-update-cause)

是上一个的加强版，不仅记录值的变化次数，还记录变化原因。多了个findUpdateCause函数，思路不难。
```typescript
function findUpdateCause<T extends Record<string, any>>(previous: T, current: T): UpdateCause[] {
    const causes = [] as UpdateCause[];
    const keys = Object.keys(previous);

    for (const key of keys) {
        const previousValue = previous[key];
        const currentValue = current[key];

        if (previousValue !== currentValue) {
            const cause: UpdateCause = {
                previousValue,
                currentValue,
                propName: key,
                shallowEquals: shallowEquals(previousValue, currentValue),
                deepEquals: deepEquals(previousValue, currentValue),
            };
            causes.push(cause);
        }
    }

    return causes;
}
```
# useDocumentEvent 
```typescript
export function useDocumentEvent<K extends EventNames>(
    eventName: K,
    fn: DocumentEventHandler<K>,
    options?: boolean | AddEventListenerOptions
) {
    const handler = useRef(fn);
    useLayoutEffect(
        () => {
            handler.current = fn;
        },
        [fn]
    );
    useLayoutEffect(
        () => {
            const trigger: DocumentEventHandler<K> = e => handler.current(e);
            document.addEventListener(eventName, trigger, options);
            return () => document.removeEventListener(eventName, trigger, options);
        },
        [eventName, options]
    );
}
```
从源码来看，就是document.addEventListener/removeEventListener的hook版，奇怪的是，为啥要在useLayoutEffect里调addEventListener，正常操作，不是都是useEffect？还有为啥要用useLayoutEffect充当watch函数，直接这样不行吗？

```typescript
const handler = useRef(fn);
handler.current = fn
```
# useDocumentTitle
看起来挺无聊的一个hook。不过我曾见过一些react写的pc网站，单页面应用，用react-router充当路由，不同的route有不同的document.title。这种场景下这个hook就挺有用的。
# useElementResize
[文档](https://ecomfe.github.io/react-hooks/#/hook/element-size/use-element-resize)

监听一个元素是否resize（大小是否变化），内部使用了[resize-detector](https://github.com/Justineo/resize-detector) ,具体的细节，可以去看resize-detector的源码。

```typescript
export function useElementResize(callback: (element: HTMLElement) => void): ElementResizeCallback {
    const update = useCallback(
        (element: HTMLElement) => {
            const notifyResize = (element: HTMLElement) => callback(element);
            addListener(element, notifyResize);

            return () => {
                removeListener(element, notifyResize);
            };
        },
        [callback]
    );
    const ref = useEffectRef(update);
    
    // const lazyUpdate = useIntendedLazyCallback(update) 加个“性能桥”是不是好一点
    // const ref = useEffectRef(lazyUpdate); 

    return ref;
}
```
很好理解，基本上是resize-detector的hook实现。别扭的地方在于返回的ref是个函数，供callback形式ref使用，就像这样：
```javascript
const app = ()=>{
    const ref = useElementResize(ele=>{
        
    })
    return (
        <div ref={ref} id={'test'}>
            app
        </div>
    )
}
```
不像常规思维 const resize = resizeDetector(document.getElementById('test''))) 那样直观。
至于文档上说的useElementResize不会在初次mounted时触发，我猜还是与resize-detector的内部实现有关，这个库也是bd的某大神写的，可以看一下内部实现。

# useElementSize
[文档](https://ecomfe.github.io/react-hooks/#/hook/element-size/use-element-size)

返回一个元素的size（宽高），并且在元素resize时更新size。来看源码。

我发现这类封装倒着理解会比较好。

```typescript
export function useElementSize(): [ElementResizeCallback, Size | undefined] {
    const [size, setSize] = useState<Size | undefined>(); 
    const updateSize = useCallback( // 5. 怎样更新size呢？updateSize内部调用了setSize
        (element: HTMLElement) => {
            const size = {
                width: element.offsetWidth,
                height: element.offsetHeight,
            };
            setSize(size);
        },
        []
    );
    const resize = useElementResize(updateSize); // 4. 通过调用useElementResize知道元素是否resize
    const observeElementSize = useCallback( 
        (element: HTMLElement | null) => {
            resize(element); // 3. 元素resize时更新宽高

            if (element) {// 2. mounted时记录元素宽高
                updateSize(element);
            }
        },
        [resize, updateSize]
    );
    return [observeElementSize, size]; // 1. observeElementSize用于函数形式的ref，size是存储宽高的状态容器。
}
```
# useScript
[文档](https://ecomfe.github.io/react-hooks/#/hook/script/use-script)
平平无奇的一个封装，可能某些业务场景确实能用到，核心是利用document.createElement('script')与document.head.appendChild(script)这种直接操作dom的方式加载某些js，并且缓存了加载结果。代码挺简单的，有兴趣可以去看源码，这里略过。
# useScriptSuspense
useScript的Suspense版本。
```typescript
export function useScriptSuspense(src?: string): boolean {
    if (!src) {
        return true;
    }

    const result = CACHE[src];

    if (typeof result === 'boolean') { //标记1
        return result;
    }

    throw loadScript(src); // 标记2
}
```
先说一下react Suspense组件的原理，当Suspense组件的子组件throw一个promise时，这个错误会被Suspense组件捕获，从而中断子组件的渲染，降级渲染Suspense组件的fallback，等这个promise resolve了，Suspense组件会重新render子组件，这时子组件需要return出正确的内容，不然会不停的触发Suspense机制。

Suspense机制并不强制使用React.lazy，相反React.lazy只是一个Suspense机制下的工具方法。上面的useScriptSuspense核心代码仅仅是从标记1到标记2那三行。

首先loadScript会返回一个promise，当这个promise resolve后，loadScript会在CACHE里面缓存这个资源。代码一目了然，首先看缓存里有没有该资源，有则返回，没有则加载（触发Suspense），当promise resolve会再次render，这时缓存里已经有了该资源，可以提前return，Suspense结束。
# useDebouncedEffect
[文档](https://ecomfe.github.io/react-hooks/#/hook/debounce/use-debounced-effect)
和函数去抖有点语义上的不一样，这个叫做effect去抖，在语义上可能是useEffect的debounce版本。来看源码(可以先忽略immediate相关的逻辑)。

忽略掉immediate的代码长这样。
```typescript
useEffect(
    () => {
        if (wait <= 0) {
            return;
        }
        cleanUpRef.current();
        cleanUpRef.current = noop;

        const callback = callbackRef.current;
        const trigger = () => { //3. 执行callback，并且callback可以返回一个函数来执行额外的清理工作
            const cleanUp = callback();

            if (typeof cleanUp === 'function') {
                cleanUpRef.current = cleanUp;
            }
            else if (cleanUp !== undefined) {
                // eslint-disable-next-line no-console
                console.warn('useDebouncedEffect callback should return undefined or a clean-up function');
            }
        };

        const cleanUp = tick => {
            clearTimeout(tick);
            cleanUpRef.current();
            cleanUpRef.current = noop;
        };
        const tick = setTimeout(trigger, wait); // 1. 每次useEffect都会起一个定时器，延时执行trigger,同时结束掉上一个
        return () => cleanUp(tick); // 2. 结束掉上一个Timeout，并且执行清理工作

        // if (immediate && cleanUpRef.current === noop) {
        //     trigger();
        //     cleanUpRef.current = trigger;

        //     const tick = setTimeout(() => (cleanUpRef.current = noop), wait);
        //     return () => cleanUp(tick);
        // }
        // else {
        //     const tick = setTimeout(trigger, wait);
        //     return () => cleanUp(tick);
        // }
    },
    [dependency, wait]
);
```
我们再来看这个immediate，immediate的需求来自这个[pr](https://github.com/ecomfe/react-hooks/issues/76)，我们把去抖分为两种，即先去抖后执行，和先执行后去抖。举个例子，假如我们的wait是1s，然后我们连续点击某个按钮（间隔时间小于1s），如果是先去抖，则callback会在最后一次点击的wait秒后执行，如果是先执行，则callback会立即执行，后续间隔小于wait的点击不再响应，而immediate则属于后者。

但是据我观察（调试运行），源码中关于immediate的部分是有问题的，根本不是先执行后去抖的效果，像是wait=0的效果，为什么会这样？每次dependency变化执行useEffect，会先执行cleanup，所以说immediate && cleanUpRef.current === noop一直都是true。

应该写成这样

```typescript
export function useDebouncedEffect<T>(
  callback: () => void | (() => void),
  dependency: T,
  wait: number,
  option: DebounceOption = {}
): void {
  const callbackRef = useRef(callback);
  const cleanUpRef = useRef(noop);
  const { immediate } = option;
  const immFlagRef = useRef(false); //add

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (wait <= 0) {
      return;
    }

    cleanUpRef.current();
    cleanUpRef.current = noop;

    const callback = callbackRef.current;
    const trigger = () => {
      const cleanUp = callback();

      if (typeof cleanUp === "function") {
        cleanUpRef.current = cleanUp;
      } else if (cleanUp !== undefined) {
        // eslint-disable-next-line no-console
        console.warn(
          "useDebouncedEffect callback should return undefined or a clean-up function"
        );
      }
    };

    const cleanUp = (tick) => {
      if (!immediate) { // update
        clearTimeout(tick);
      }
      cleanUpRef.current();
      cleanUpRef.current = noop;
    };
    let tick: number; //add

    if (immediate && !immFlagRef.current && dependency) { //update
      trigger();
      immFlagRef.current = true; //add
      tick = setTimeout(() => (immFlagRef.current = false), wait); //update
    } else {
      if (!immediate) {// update
        tick = setTimeout(trigger, wait);
      }
    }
    return () => cleanUp(tick); //update
  }, [dependency, wait, immediate]);
}
```
这样就可以了。用一个immFlagRef保存immediate抖动的状态，然后在cleanup中也不清理定时器。
# useDebouncedValue
useDebouncedEffect的语法糖，略。
# useDebouncedCallback
[文档](https://ecomfe.github.io/react-hooks/#/hook/debounce/use-debounced-callback)
用debounce这个库实现的去抖，与useDebouncedEffect使用场景上有所不同。看一下useDebouncedEffect文档上的例子用useDebouncedCallback怎么写。
```tsx
export default () => {
  const [message, setMessage] = useState("");
  
    const debounceFunc = (e) => {
        console.log("change");
        setMessage(e.target.value);
    };

  return (
    <>
      <div>
        <Input placeholder="input something..." onChange={debounce(debounceFunc, 1000)} />
      </div>
      <div style={{ marginTop: 20, color: "red" }}>{message}</div>
    </>
  );
};
```
看起来这个更简洁，但是细心的你可能已经发现，这个例子没有value/setValue相关的逻辑，为什么不写呢？因为如果在Input的onChange里面实时的setValue，会导致组件rerender，而useDebouncedCallback内部并没有把callback当成ref缓存起来，而是使用了useMemo，一旦组件render，callback变化，接着debouncedCallback变化，整个debounce会重新初始化。需要这么改
```typescript
export function useDebouncedCallback<C extends (...args: any) => any>(
    callback: C,
    wait: number,
    option: DebounceOption = {}
): C {
    const callbackRef = useRef(callback); //add
    callbackRef.current = callback; //add

    const { immediate } = option;
    const debouncedCallback = useMemo(
        () =>
            wait > 0 ? debounce(callbackRef.current, wait, immediate) : callback, //update
        [wait, immediate] //update
    );
    useEffect(() => {
        return () => {
            const callback = debouncedCallback as any;
            callback.clear && callback.clear();
        };
    }, [debouncedCallback]);

    return debouncedCallback;
```
```typescript jsx
export default () => {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");

  const onChange = useDebouncedCallback((e) => {
    console.log("change");
    setMessage(e.target.value);
  }, 1000);

  console.log("render");

  return (
    <>
      <div>
        <Input
          placeholder="input something..."
          value={value} // update
          onChange={(e) => { //update
            setValue(e.target.value);
            onChange(e);
          }}
        />
      </div>
      <div style={{ marginTop: 20, color: "red" }}>{message}</div>
    </>
  );
};
```
这样一来，immediate参数也好使了。使用原先的源码运行demo，immediate参数是不能用的，症状和useDebouncedEffect一样。

# useTimeout useInterval
这俩货不必多说，分别是用hook思维封装的setTimeout与setInterVal,不过源码中有一处令人奇怪。
```typescript jsx
const fn = useRef(callback);
useEffect(
    () => {
        fn.current = callback;
    },
    [callback]
);
```
使用useRef缓存fn无可厚非，但是为啥不写成这样
```typescript jsx
const fn = useRef(callback);
fn.current = callback;
```
反正ref的变化不会引起rerender，多执行几次又有什么关系。
#useStableInterval
[文档](https://ecomfe.github.io/react-hooks/#/hook/timeout/use-stable-interval)

好简的文档，useStableInterval的这个名字也不能直接看出这个封装是干嘛的。

原生的setInterval只能定时执行一个同步任务，假设我们要定时执行某个异步任务，这个hook便派上用场了。举个例子
```typescript jsx
import {useState,useLayoutEffect,useRef} from 'react'

import {useStableInterval} from './hooks'

export default function App() {
  const [count,setCount] = useState(0)
  const [done,setDone] = useState(false)
  useStableInterval(()=>{
    if(count < 10){
      return new Promise((resolve,reject)=>{
        setTimeout(()=>{
          setCount(count + 1)
          resolve(undefined)
        },2000)
      })
    }
    else {
      setDone(true)
    }
  },1000)
  return (
    <>
      <div>{count}</div>
      {
        done ? <div>done</div> : null
      }
    </>
  )
}
```
每隔1秒去执行耗时2秒的异步任务，直到count === 10。知道了该hook的作用，然后去看源码:smile:

源码里面有个running，是为了处理某些边界问题，先忽略。
```typescript jsx
export function useStableInterval(callback: (() => any) | undefined, time: number): void {
    const fn = useRef(callback);
    useEffect(
        () => {
            fn.current = callback;
        },
        [callback]
    ); //前两句不说了，用ref缓存callback
    useEffect(
        () => {
            if (time < 0) {
                return;
            }

            // To get rid of type checking on Node's `setTimeout` function
            let tick: any = null;
            // let running = true;
            const trigger = () => {
                const next = () => {
                    // It is possible that when `clearTimeout` is happening an async callback is in pending state,
                    // then when this callback resolves it will continue to start a new timer,
                    // therefore we need a `running` flag to indicate whether a future timer is able to start.
                    // if (running) {
                    //     tick = setTimeout(trigger, time);
                    // }
                    tick = setTimeout(trigger, time); // 4.再次执行1、2、3
                };

                if (!fn.current) {
                    next();
                    return;
                }

                const returnValue = fn.current(); // 2.执行callback
                if (typeof returnValue?.then === 'function') {
                    returnValue.then(next, next); // 3. 如果returnValue是promise，执行promise，并在promise返回以后执行next
                }
                else {
                    next();
                }
            };
            tick = setTimeout(trigger, time); // 1.setTimeout去执行trigger

            return () => {
                // running = false;
                clearTimeout(tick);
            };
        },
        [time]
    );
}
```
再来看那个running是干嘛的，第二个useEffect的依赖只有个time，当time变化时，清除上一个tick，并重新执行定时器，这时候很可能出现上一个promise正在pending，这个不该出现的promise一旦resolve就会执行next，所以为了阻止这种情况发生，加了个running flag。
# useScrollIntoView
[文档](https://developer.mozilla.org/zh-CN/docs/Web/API/Element/scrollIntoView)

看起来是[scrollIntoView](https://developer.mozilla.org/zh-CN/docs/Web/API/Element/scrollIntoView) 的hook实现。想一下什么时候会用到scrollIntoView，我能想到的有两只情况。一种是由某个动作触发scrollIntoView（比如说click事件），一种是组件mounted时触发scrollIntoView。对于前一种，这样写就可以了
```typescript jsx
const app = ()=>{
    const onClick = useRef(()=>{
        eleRef.current.scrollIntoView()
    }).current
    const eleRef = useRef()
    return (
        <div>
            <div ref={eleRef}>asas</div>
            <button onClick={onClick}>scrollIntoView</button>
        </div>
    )
}
```
对于后一种可以这样写
```typescript jsx
const app = ()=>{
    const eleRef = useRef()
    useEffect(()=>{
        eleRef.current.scrollIntoView()
    },[])
    return (
        <div ref={eleRef}>xwcwc</div>
    )
}
```
然后再回过头来看useScrollIntoView，这个封装适用上述两种情况。第一种情况可以这样写
```typescript jsx
const app = ()=>{
    const [active,changeActive] = useState(false)
    const eleRef = useRef()
    useScrollIntoView(ref,active)
    
    return (
        <div>
            <div ref={eleRef}>asas</div>
            <button onClick={()=>{
                changeActive(true)
            }}>scrollIntoView</button>
        </div>
    )
}
```
第二种情况
```typescript jsx
const app = ()=>{
    const eleRef = useRef()
    useScrollIntoView(ref,true)
    return (
        <div>
            <div ref={eleRef}>asas</div>
        </div>
    )
}
```
源码就不赘述了，比较简单。
# useScrollLock
[文档](https://ecomfe.github.io/react-hooks/#/hook/scroll-lock/use-scroll-lock)

某些场景下需要禁止页面滚动，比如打开某个modal。实现思路也很简单，useEffect执行时设置body的overflow为hidden，并且记录原始的overflow（用于清除副作用）。其实仅仅设置body的overflow为hidden在某些手机上是不生效的，比如[张鑫旭](https://www.zhangxinxu.com/wordpress/2016/12/web-mobile-scroll-prevent-window-js-css/) 的这篇文章。如果不考虑Safari浏览器可以这样实现。
```typescript jsx
export function useScrollLock(lock: boolean): void {
    // const previousOverflowRef = useRef('');
    useEffect(
        () => {
            if (!lock) {
                return;
            }

            /* istanbul ignore next */
            if (typeof document === 'undefined') {
                return;
            }

            // previousOverflowRef.current = document.body.style.overflow; 
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'relative'
            document.documentElement.style.overflow = 'hidden'

            return () => {
                // Do not reset if other scripts modify style.
                if (document.body.style.overflow === 'hidden') {
                    document.body.style.overflow = ''
                    document.body.style.position = ''
                    document.documentElement.style.overflow = ''
                }
            };
        },
        [lock]
    );
}
```
# useScrollPosition
[文档](https://ecomfe.github.io/react-hooks/#/hook/scroll-position/use-scroll-position)
实时记录某个元素或者窗口的滚动位置。看起来挺无聊的一个封装，来看源码有没有值得学习的地方。
```typescript
export function useScrollPosition(target?: Target): ScrollPosition {
    const rafTick = useRef(0);
    const [position, setPosition] = useState(INITIAL_POSITION);
    useEffect(
        () => {
            if (target === null) {
                return;
            }
            const targetNode = getTargetNode(target); //1. target要么是element类型的元素，要么为空，如果是空，target为document
            const targetElement = targetNode === document ? document.documentElement : targetNode as HTMLElement; //2. 根据target获取targetElement
            setPosition(getScrollPosition(targetElement)); // 3.记录初始position

            const syncScroll = () => { // 5.这个方法很奇怪，它并没有实时的setPosition，而是用requestAnimationFrame中转了一下，这样做可以保证在一帧的时间内只执行一次setPosition，提高性能。
                if (rafTick.current) {
                    return;
                }

                const callback = () => {
                    setPosition(getScrollPosition(targetElement));
                    rafTick.current = 0;
                };
                rafTick.current = requestAnimationFrame(callback);
            };

            targetNode.addEventListener('scroll', syncScroll, EVENT_OPTIONS); // 4.监听滚动事件，执行syncScroll方法

            return () => {
                targetNode.removeEventListener('scroll', syncScroll, EVENT_OPTIONS);
                cancelAnimationFrame(rafTick.current);
            };
        },
        [target]
    );

    return position;
}
```
# useScrollTop
# useScrollLeft
这俩内部都调用了useScrollPosition，略。
# useSelection
[文档](https://ecomfe.github.io/react-hooks/#/hook/selection/use-selection)
看起来（看示例）挺复杂的一个实现，实际上没那么复杂。先看示例代码。
```typescript
//...
const [selection, {selectIndex}] = useSelection([], {multiple: true, range: true});
// selection是一个表示范围的数组，数组的每一项为dataSource的下标，selectIndex是个函数，调用selectIndex可以影响selection的值，感觉useSelection也可以用useMethods实现
//...
const renderItem = (item, i) => {
    return (
        <li key={item.id}
            className='text-style'
            style={{ backgroundColor: selection.includes(i) ? '#e6f7ff' : undefined }}
            onClick={e => selectIndex(i, e)}> // 这里，点击的时候，selectIndex内部会判断各种点击（是否同时按了ctrl/shift），是否是初次点击，以及该行数据的下标，从而输出符合交互正确的selection。也就是说useSelection只输出下标数组，不管dom的样式或者行为。
            {item.text}
        </li>
    );
};
return (
    <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
        {dataSource.map(renderItem)}
    </ul>
);
```
[源码](https://github.com/ecomfe/react-hooks/blob/master/packages/selection/src/index.ts) 看起来有点小长，实际上分为两部分：

1. 使用useReducer封装的记录每次点击各项数据的状态集。总共分三种点击，普通的单点、是否按了Ctrl或者shift。每种情况生成不同的selected
2. selectIndex，selectIndex内部调用getActionType通过event与options，来判断该执行哪种点击的逻辑。

```typescript
const getActionType = (e?: ClickContext, options: SelectionOptions = DEFAULT_OPTIONS): Action['type'] => {
    if (!e) {
        return 'single';
    }
    if (e.shiftKey) {
        return options.range ? 'range' : 'single';
    }
    if (e.metaKey || e.ctrlKey) {
        return options.multiple ? 'multiple' : 'single';
    }
    return 'single';
};
```
一目了然，结果分三种情况，range、multiple、single，与useReducer里面的三种点击一一对应。

先看比较简单的两种点击，单点与按住Ctrl点，对应代码如下

```typescript
const toggleSingleSelected = (selected: number[], target: number): number[] => { // 按住ctrl点击列表在交互上通常是多选行为
    if (selected.includes(target)) {// 如果点击元素的索引已经在selected里了，从selected里面去除，也就是反选效果。
        return without(selected, target);
    }
    return selected.concat(target); // 如果点击元素的索引没有在selected里，加到selected里面，也就是选中效果
};
//...
const nextSelected = type === 'single' ? [payload] : toggleSingleSelected(selected, payload); // 如果是单点，返回该条数据索引，否则（按住ctrl）执行toggleSingleSelected
return {
    rangeStart: payload,
    rangeEnd: undefined,
    selected: nextSelected,
};
//...
```

再来看按住shift选中一列数据的逻辑，这种交互比较复杂，从代码分支来看，也分为三种情况。

第一种情况

```typescript
if (rangeEnd === undefined) { // 什么情况下rangeEnd === undefined，上一次点击行为为普通的单点时 rangeEnd === undefined，而这一次再按住shift点别的行，就会走这里的代码
    const extra = payload < rangeStart // range的文档建议去查lodash，简单说range的作用会根据传入的两个数字参数，生成一个范围数组。
        ? range(payload, rangeStart + 1)
        : range(rangeStart, payload + 1);
    return {
        rangeStart,
        rangeEnd: payload,
        selected: union(selected, extra),
    };
}
```
对应的交互

![shift_1.gif](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/shift_1.gif)

第二种情况

```typescript
else if (payload === rangeEnd) { //如果本次按住shift点击对应的索引和上次一样，则返回上次的state
    return state;
}
```

第三种情况

交互图

![4e096b8a-1e72-43a0-9633-881bac807694-动画2.gif](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/4e096b8a-1e72-43a0-9633-881bac807694-动画2.gif)

适用于已经按住shift选中一片区域，再次按shift的场景

代码
```typescript
const currentRange = range(
    Math.min(rangeStart, rangeEnd),
    Math.max(rangeStart, rangeEnd) + 1
); //这里的currentRange从交互上来看，应该是上一次选中的范围
const nextRange = range(
    Math.min(rangeStart, payload),
    Math.max(rangeStart, payload) + 1
);// 从交互上来说，应该是本次选中的范围
const nextSelected = union(difference(selected, currentRange), nextRange); // 两者先取差集再取并集，得到的结果就是最后的范围。不过从我实际操作来看，大多数情况下，nextSelected与nextRange是相等的。
return {
    rangeStart,
    rangeEnd: payload,
    selected: nextSelected,
};
```




