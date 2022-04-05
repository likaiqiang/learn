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
const useMethods = (modal,reducers)=>{
    const [state,setState] = useState(modal)
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
和文档中的例子用法差不多，略有不同。我们都知道react中数据是不可变的，如果你的modal是复杂的数据，更新起来会很麻烦，有一个库叫做[use-immer](https://github.com/immerjs/use-immer)，可以上github看看它的用法，挺好用的，和useState的区别，可以看[这里](https://stackoverflow.com/questions/61669930/whats-the-difference-between-usestate-and-useimmer)

了解了上面一大堆，再来看useMethodsNative[源码](https://github.com/ecomfe/react-hooks/blob/master/packages/methods/src/native.ts)。

忽略typescript，发现与我们自己实现的useMethods差不多，但是为啥叫useMethodsNative，native即原生的，也就是使用useState更新数据，而大多数情况下我们的modal都是复杂数据，所以推荐使用[useMethods](https://github.com/ecomfe/react-hooks/blob/master/packages/methods/src/immer.ts)。

# useBoolean/useSwitch/useSwitch

如果理解了useMethods/useMethodsNative，这三个封装完全是useMethodsNative的快捷方式。

我们来看看文档中useBoolean的例子直接使用useMethods应该怎么写。

```javascript
const useMethods = (modal,reducers)=>{ // 下文如果有用到useMethods，指的都是这个方法
    const [state,setState] = useImmer(modal)
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

#useInfiniteScroll
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

#useDerivedState
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
我觉得大多数情况下不需要useOriginalCopy，暂时想不出使用场景，以后想到了再补充。来看源码。

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
第二个参数默认是浅比较，可以传deepEquals从来衍生出useOriginalDeepCopy。


