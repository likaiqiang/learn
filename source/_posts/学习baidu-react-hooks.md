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


