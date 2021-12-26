---
title: 学习vue-clamp
date: 2021-12-21 22:34:11
tags:
---
# 前言
[项目地址](https://github.com/Justineo/vue-clamp)

无意间看到这个库，利用getClientRects与二分法实现多行文字的超出截断，虽说flex更简洁，但是想起我n年前兼容IE时的痛楚，虽说现在不用兼容IE了，但是原理什么的还是忍不住瞅一眼。

关键是知不知道[getClientRects](https://developer.mozilla.org/zh-CN/docs/Web/API/Element/getClientRects) 。这玩意兼容性好强大。假如是行内元素调用getClientRects，会返回一个rects集合，这个集合的length就是文本的行数，好简洁，完全不用关心行高什么的。

# api
1. tag: 由于内部是由render函数生成的vnode，比起template，tag是可以变的，默认是div。
2. autoresize: 内部使用resize-detector这个库监听组件的resize事件，size变化时，更新截断状态。
3. max-lines: 最大行数
4. max-height: 最大高度。max-height与max-lines指定一个即可。
5. ellipsis: 省略符号，默认...
6. location: ellipsis的位置，默认end。
7. expanded: 初始状态是否展开，默认false。

slot

1. default：默认插槽为文本的实际内容（非展示内容）。
2. after/before：这俩插槽取其一，关于它们的slot scope后面会说。

# 用代码简述原理
vue组件不好解释，语法灵活/随意，各种数据自动响应，计算属性什么的互相依赖，读起来挺爽的，给别人解释可太难了。所以我先写个小而美的clamp，方便理解核心原理。

```typescript jsx

export default {
    props:{
      lines:{
          type: Number,
          default: 3
      }
    },
    data(){
        return {
            text:this.getText(),
            offsetSet: this.getText().length
        }
    },
    render(){
        const [content] = this.$slots.default
        return (
            <span ref="text">
                {content}
            </span>
        )
    },
    mounted(){
        if(this.isOverflow()){
            this.search()
        }
    },
    methods:{
        search(from=0,to=this.text.length){
            if(to-from<=3){
                console.log('done');
                return
            }
            this.offset = Math.floor((from + to) / 2)
            this.$refs.text.textContent = this.text.slice(0,this.offset)
            if(this.isOverflow()){
                this.search(from,this.offset)
            }
            else{
                this.search(this.offset,to)
            }
        },
        getText(){
            const [content] = (this.$slots.default || []).filter(
                (node) => !node.tag && !node.isComment
            )
            return content ? content.text : ''
        },
        getLines(){
            return this.$refs.text.getClientRects().length
        },
        isOverflow(){
            return this.getLines() > this.lines
        }
    }
}
```
只有一个props（lines：表示文本的行数），data里面有两个属性text与offset，text表示原始的文本，offset是个信标，表示发生截断的位置，只要offset不等于text的长度，就认为文本发生了截断。

render函数里面拿到了默认插槽的vnode，并用span渲染出来，为什么是span，因为只有行内元素调用getClientRects才会返回文本长度。从这里还可以看出，插槽与渲染竟然可以分开！！
第一次渲染会渲染出全部文本，在mounted里面通过isOverflow判断是否溢出，即文本的实际行数是否大于props.lines，如果发生了溢出，调用search方法，search方法使用了二分法不停的改变offset的位置，直到from与to的差值小于等于3，为什么是3呢，我猜是省略号(...)的长度，这样就算出了最佳的offset以及最佳的截断文本。
# 源码解读
源码与我那个有什么不同：
1. 支持更多的props
2. 检测元素的尺寸是否发生变化
3. 支持更多的插槽

可以自定义tag，设置是否检测元素的尺寸变化，是否以maxHeight代替maxLines，设置省略号的文本（默认是...），以及省略号的位置。expanded设置初次渲染是否展开文本.

先从render函数看起。
[render](https://github.com/Justineo/vue-clamp/blob/master/src/components/Clamp.js#L227)
整体来看，多了before与after插槽的逻辑，before与after取其一。值得注意的是this.$scopedSlots这个api，作用域插槽在render函数里面竟然是这样用的，scope就是传递给插槽的作用域，this.$scopedSlots.before/afer(scope)的结果是vnode。然后竟然可以把组件的方法传给scope，又学到了。

mounted调用init，init内部有一些是否检测元素尺寸变化的逻辑，用了resize-detector，这个库也是作者写的，init最终调用update。update开篇有个localExpanded，这个就是props.expanded，内部写了几个watch来同步两者的状态。然后调用search，和上面的精简版不一样的是多了个stepToFit方法，这个方法的作用是微调offset，即在用二分法得到最终的文本后，最后一行文本的长度可能不满一行，先调用fill方法使文本充满一行（可能发生换行），然后调用clamp方法使文本刚好充满一行。

原理就是这样。看一下github上的demo。

before/after插槽是个button，点击button调用了toggle方法。
```typescript jsx
toggle () {
  this.localExpanded = !this.localExpanded
}
```
这句话会触发localExpanded的watch
```typescript jsx
if (val) {
    this.clampAt(this.text.length)
} else {
    this.update()
}
```
如果localExpanded为true，还原文本，否则，重新截断文本。

最后，值得注意的是mounted里面的watch写法
```typescript jsx
this.$watch(
  (vm) => [vm.maxLines, vm.maxHeight, vm.ellipsis, vm.isClamped].join(),
  this.update
)
this.$watch((vm) => [vm.tag, vm.text, vm.autoresize].join(), this.init)
```
又学到了，这种做法可以同时watch多个参数，执行相同的逻辑。



