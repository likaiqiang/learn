---
title: '整理react里面那些容易让人混淆的概念 😂'
date: 2023-04-19 14:19:09
tags:
---
# react为什么要引入fiber
在解释为什么之前，先来说一说react16之前组件的更新过程。
```javascript
class Child extends React.Component {
  componentWillMount() {
    console.log("Child componentWillMount");
  }
  render() {
    console.log("Child render");
    return <div>child</div>;
  }
  componentDidMount() {
    console.log("Child componentDidMount");
  }
  componentWillReceiveProps() {
    console.log("Child componentWillReceiveProps");
  }
  shouldComponentUpdate() {
    console.log("Child shouldComponentUpdate");
    return true;
  }
  componentWillUpdate() {
    console.log("Child componentWillUpdate");
  }
  componentDidUpdate() {
    console.log("Child componentDidUpdate");
  }
}
class App extends React.Component {
    constructor(){
        super()
        this.state = {
            count:0
        }
    }
    render(){
        return (
            <div className="App">
                <Child/>
                <div>
                    <button onClick={()=>{
                        this.setState({
                            count: this.state.count + 1
                        })
                    }}>
                        add
                    </button>
                    <span>{this.state.count}</span>
                </div>
            </div>
        );
    }
}
```
上面的例子用react15来运行，child组件没有state与props，但是随着App组件的更新（点击add按钮），child组件也跟着更新了（触发了componentWillReceiveProps、shouldComponentUpdate、componentWillUpdate、render与componentDidUpdate），这显然不合理，万一child组件很大呢，针对这种情况，react16之前可以使用shouldComponentUpdate来阻止组件不必要的更新。

虽然shouldComponentUpdate可以解决这种情况，但是这种现象暴露了react的一个弊端，父组件更新，子组件也会无脑更新，除非调用shouldComponentUpdate，为什么vue没有这种弊端，原因就是vue有响应式系统，所以vue可以很明确的知道哪些依赖需要更新，而不需要重新render整棵树。有些情况可以用shouldComponentUpdate规避掉无用更新，但是react肯定有机会重新render一颗巨大的树。我们知道react组件的更新过程，先调用render，生成新的虚拟dom，然后执行diff算法，比对新旧虚拟dom不一样的地方，最后作用到真实dom上。在这些步骤中，假如组件树很大，diff算法则需要较长时间。javascript是单线程语言，长时间的diff会卡住主线程，这种现象在react16之前是没办法解决的。

为了解决上面的问题，react16引入了fiber，首先说说什么是fiber，fiber是一种新的数据结构，用来描述一个虚拟dom，假如有以下树形结构
![0193a7ad-6941-4d1c-a999-b556be454daa-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/0193a7ad-6941-4d1c-a999-b556be454daa-image.png)

react16之前这么描述
```javascript
const vnodes = {
    key:'1',
    children:[
        {
            key:'2',
            children:[
                {key: '3'},
                {key: '4'}
            ]
        },
        {
            key:'5',
            children:[
                {key: '6'},
                {key: '7'},
                {key: '8'}
            ]
        }
    ]
}
```
react16之后这么描述
```javascript
const vnodes = {
    key:'1',
    child:{
        key:'2',
        parent:'1',
        child:{
            key:'3',
            parent:'2',
            sibling:{
                key:'4',
                parent:'2'
            }
        },
        sibling:{
            key:'5',
            parent:'1',
            child:{
                key:'6',
                parent:'5',
                sibling:{
                    key:'7',
                    parent:'5',
                    sibling:{
                        key:'8',
                        parent:'5'
                    }
                }
            }
        }
    }
}
```
对比同一张图的两种vnodes，很明显，第一个vnodes在diff的过程中是没法暂停的，因为它每个节点只有children，第二个vnodes每个节点的描述都包含自己与其他节点的关系，这样即使diff暂停，下次继续时也能找到未完成的节点。

react16以后引入了调度器的概念，它的作用是给任务分级，简而言之，就是由用户触发的更新优先级是大于组件更新的，假如react正在更新一个大组件，diff算法正在如火如荼的工作，这时用户点击了某个按钮要求显示一个提示，那这个更新的优先级最高，react会暂停大组件的更新（依赖于fiber节点的可暂停结构），先去响应按钮的提示，完了继续大组件的更新，react用这种机制来解决更新大组件主线程没有响应的问题。
# 引入fiber后所带来的的变化

## render阶段的生命周期

上面说组件更新可以被暂停，那会不会出现界面更新一半的情况，这种情况是不会出现的，原因是，react16之后，组件更新被分为render阶段与commit阶段，render阶段包括render函数的执行，diff算法的执行，一旦diff算法执行完毕，组件开始更新真实dom，就进入了commit阶段，render阶段可以被反复执行（可中断，可继续），而commit阶段每次更新只能执行一次，所以不会出现dom渲染一半的情况。

那哪些生命周期属于render阶段，哪些属于commit阶段，首先render函数肯定是在render阶段执行的，因为render函数的作用就是生成虚拟dom，完了才是diff组件以及更新真实dom的过程，所以可以肯定render函数以及它之前的生命周期都属于render阶段。之前说过render阶段的代码是可以被反复执行的，这就带来了一个问题，假如在componentWillReceiveProps、componentWillUpdate这些函数内执行了某些副作用代码，这种生命周期被反复调用的机制就会导致副作用被反复执行，这显然不对，react为了解决这种问题，对render阶段的一些生命周期进行了改造，其实主要采取了两种改造手段：

1. 把实例方法改成静态方法，比如把componentWillReceiveProps改成static getDerivedStateFromProps，这样改的目的就是不让访问this，一个纯函数被反复执行其实没什么不好。
2. 标记某些方法是不安全的，随着版本的升级，逐步废弃。

庆幸的是，shouldComponentUpdate这个方法逃过一劫，原因可能是这个方法语义太明显了，大概没有什么人在这个方法里面执行副作用代码。

## commit阶段的生命周期

上面说render函数以及之前的生命周期都属于render阶段，那commit阶段呢，有人会说componentWillUpdate？很遗憾，这个生命周期也属于render阶段，并且react16以后被打上了不安全的标记，那有什么方法可以知道更新进入了commit阶段，react16新加了getSnapshotBeforeUpdate，别看这个方法的命名也是getxxx之类的风格，它却是一个实例方法，为什么react这次让人大方的访问this，原因在于更新已经进入commit阶段，即使有副作用也只执行一次没什么不好。

getSnapshotBeforeUpdate这个方法会在diff结束（是结束不是中断），已经知道哪些dom需要更新，但是还没有被更新的时候调用，所以它可以稳定的获取更新前的dom状态。

## 捕获error

react16以后新增了一个叫getDerivedStateFromError的生命周期，从这个函数的名字来看很像getDerivedStateFromProps，没错它也是一个静态方法，就是不让你访问this。react16之前是怎么捕获错误呢，有一个叫componentDidCatch的方法，这个方法在react16以后也一直保留，为什么出现既生瑜何生亮的场面，原因在于这俩方法的职责不同，举个例子来说明。

```javascript
class Child extends React.Component {
  render() {
    const { count, onClick } = this.props;
    if (count < 5) {
      return (
        <div>
          <button onClick={onClick}>add</button>
          <span>{count}</span>
        </div>
      );
    }
    throw new Error("123");
  }
}
class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            count: 0
        };
    }
    static getDerivedStateFromError(error) {
        console.log("getDerivedStateFromError has error", error);
    }
    componentDidCatch(error, info) {
        console.log("componentDidCatch has error", error, info);
    }
    render() {
        return (
            <>
                <div>app</div>
                <Child
                    count={this.state.count}
                    onClick={() => {
                        this.setState({
                            count: this.state.count + 1
                        });
                    }}
                />
            </>
        );
    }
} // react18.2.0
```
我们在子组件的render函数里面抛一个错，结果发现只有getDerivedStateFromError响应了，我们换个例子：
```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error, info) {
    console.log("componentDidCatch has error", error);
    this.setState({ hasError: true });
  }
  static getDerivedStateFromError(error) {
    console.log("getDerivedStateFromError has error", error);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}
class MyComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = { value: 0 };
    }

    componentDidUpdate() {
        if (this.state.value === 3) {
            // 模拟一个错误
            throw new Error("I crashed!");
        }
    }
    handleClick = () => {
        this.setState({ value: this.state.value + 1 });
    };

    render() {
        return <button onClick={this.handleClick}>{this.state.value}</button>;
    }
}
function App() {
    return (
        <ErrorBoundary>
            <MyComponent />
        </ErrorBoundary>
    );
} // react18.2.0
```
在子组件的componentDidUpdate（commit阶段）里面抛个错，结果getDerivedStateFromError与componentDidCatch都响应了。

对比这两个例子你会发现，react把捕获错误这个行为分为有副作用的捕获与无副作用的捕获，像在render函数里面发生的错误，render函数处于render阶段，react肯定不希望开发者访问this，所以理所当然的只有getDerivedStateFromError响应，而在componentDidUpdate里面抛的错，由于已经处于commit阶段，开发者想干什么react不会去干预，这时的捕获错误的行为可能是纯的也可能是不纯的，所以两个函数都会响应。

## Suspense
## hooks
这里不一一介绍每个hook，只是说明为什么会推出hooks，以及render与commit阶段都有哪些hook。

### 为什么推出hooks
1. 首先react16以后由于引入了可中断更新，在render阶段访问this将变得不安全，除了上面的两种改造外，完全杜绝this也是一种方案，所以react更推崇使用函数式组件。
2. react hooks在逻辑复用方面是一把利器，它可能很容易的把逻辑与渲染分开，为什么要分开，简而言之，渲染（ui）是很难抽象与复用的，而逻辑恰恰相反。

### render阶段的hooks
useState、useMemo、useCallback、useRef、useContext、useReducer、useEffect、useLayoutEffect

其中useEffect、useLayoutEffect这俩允许执行副作用的hook也是在render阶段执行的。你可能会疑惑，render阶段不是不让执行副作用操作嘛，这俩虽然在render阶段执行，但是它们的回调函数不在render阶段执行。

### commit阶段的hooks
useEffect与useLayoutEffect的回调函数。

先说useLayoutEffect。这个hook会在dom更新完毕，但是浏览器还没有来得及绘制之前同步执行。这句话是什么意思呢，我们知道javascript只是用来操作dom，像setState之类操作或者我们手动操作dom只是改变了内存里一颗dom树上的某些节点，真正把dom树绘制成屏幕上形形色色的画面是浏览器完成的，假设我们浏览器一秒绘制60帧，那绘制一帧的时间就是16ms，而javascript是单线程语言，执行js代码与ui绘制是互斥的，所以如果我们在16ms内用10ms的时间来更新dom树，那么还剩6ms用来执行useLayoutEffect与浏览器绘制界面。

所以这个hook内部适合执行一些短小精悍的代码，假如执行时间过长，浏览器没有足够的时间在一帧内完成界面绘制，就会造成卡顿。

对比介绍类组件时也有个在commit阶段执行的函数，getSnapshotBeforeUpdate，useLayoutEffect与getSnapshotBeforeUpdate的执行时机却有细微的差别，前者是在真实dom更新完毕浏览器还未绘制之前触发，这时拿到的是更新后的dom，后者是在真实dom还未更新即将更新时触发，这时拿到的是更新前的dom。

最后说一下useEffect，这个hook的回调函数是在commit阶段执行完毕异步执行的。这时dom已经更新完毕并且浏览器也完成了绘制，因为是异步执行，所以不像useLayoutEffect那么小心翼翼的。
