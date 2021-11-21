---
title: 学习react-whether
date: 2021-11-21 21:52:20
tags:
---
# 前言
我们在用react写业务时，常常要处理一些条件逻辑，由于jsx里面只有写表达式，不能写语句，所以有时不得不写一大坨这样的代码。

```typescript
render(){
    return (
        isMatch ? <CommentA/> : <CommentB/>
    )
}
```
要么像这样把大片逻辑封装成组件，要么写个函数
```typescript
render(){
    return (
        {this.renderComponent()}
    )
}
renderComponent(){
    return isMatch ? <CommentA/> : <CommentB/>
}
```
这两种方法都不完美，有时候并不想凭空写一个方法或者封装组件，并且代码可读性也不好。

那么有没有更优雅的方法，当然有，所谓前人栽树，后人乘凉，我们只要虚心学习就可以了。

[react-whether](https://github.com/otakustay/react-whether) ,看文档可以去这里，本文介绍的是其源码。

# 源码解读
首先打开src/index.ts
```typescript
export {default as Whether} from './Whether';
export {default as Match} from './Match';
export {default as Else} from './Else';
```
从文档可以看出[Whether](https://github.com/otakustay/react-whether/blob/master/src/Whether.tsx) 是其root component。

从代码可以看出Whether本质上是一个函数式组件，除了children，接收matches和context两个prop。

代码开篇判断matches是不是一个boolean，本质上是在判断有没有传matches，如果matches是个boolean，走的是IfElseMode或者IfMode，否则走的是SwitchMode。

通过计算Whether的children的数量count，来判断是IfElseMode或者IfMode，如果count <= 1,走的是IfMode，如果count > 1 并且chidren的最后一项是else，走的是IfElseMode，否则走的是IfMode。

[IfMode](https://github.com/otakustay/react-whether/blob/master/src/IfMode.tsx)
[IfElseMode](https://github.com/otakustay/react-whether/blob/master/src/IfElseMode.tsx)

这俩货代码很相似，内部都调用了Render组件

```typescript
<Render>{matches ? children : null}</Render> //IfMode
<Render>{matches ? ifChildren : elseChildren}</Render> //IfElseMode
```

这是只传matches的情况，接下来看只传context的情况，也就是switchMode

```typescript
if (typeof matches !== 'boolean') {
        const elements = Children.toArray(children) as Array<React.ReactElement<any>>;
        const branches = elements.map(elementToBranch);
        return <SwitchMode context={context} branches={branches} />;
    }
```
```typescript
const elementToBranch = ({type, props}: React.ReactElement<any>): MatchProp | BranchPropWithSelector => {
    if (type === Match) {
        return props;
    }

    return {
        selector() {
            return true;
        },
        children: props.children,
    };
};
```
elementToBranch 的作用是整合props与children，生成统一的branches，因为children可能是Match，也可能不是。最后调用SwitchMode组件。

[SwitchMode](https://github.com/otakustay/react-whether/blob/master/src/SwitchMode.tsx)

```typescript
const SwitchMode: React.SFC<SwitchModeProp> = ({context, branches}) => {
    const branch = branches.find(({selector}) => selector(context));

    return <Render>{branch ? branch.children : null}</Render>;
};
```
代码与ifMode很相似，唯一的区别是多了个branch，这里用find方法很巧妙。假如我代码这么写。

```typescript
const App = ()=>{
    const [user,changeUser] = useState({
        type:'foo'
    }) 
    return (
        <Whether context={user}>
            <Match selector={user=>user.type === 'foo'}>
                111
            </Match>
            <Match selector={user=>user.type === 'bar'}>
                111
            </Match>
            <Else>
                else
            </Else>
        </Whether>
    )
}
```
按照elementToBranch的逻辑，假如children的某一项不是Match，会生成返回true的selector函数，但是数组的find方法永远只返回第一个符合条件的值。所以最后一项是不是Else组件根本不重要，写成div也可以，关键是顺序。

最后看一下三个mode都用到的Render组件。

```typescript
const Render: React.SFC<RenderProp> = ({children}): React.ReactElement<any> => {
    return <>{isRenderFunc(children) ? children() : children}</>; //懒加载的实现
};
```




