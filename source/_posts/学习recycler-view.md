---
title: 学习recycler-view
date: 2021-11-20 23:36:13
tags:
---
# 前言
大数据的列表滚动一直是很头疼的问题，尤其无限滚动这种场景，不像人家安卓，有RecyclerView这种内置组件可以用。前端只能可怜巴巴的自己实现，幸好前人栽树，后人乘凉，业界有同行已经写了一些实现，本文将要介绍的便是其中一种。

https://github.com/hdcoo/recycler-view

# 大概原理

先去[这里](https://github.com/hdcoo/recycler-view-demo) ,下载demo源代码，clone下来后npm install,然后访问http://localhost:5211/recycler-view-demo/， 我们要介绍的是经典两列布局的瀑布流，也就是入口是waterfall.js的那个例子。

demo项目运行起来以后，打开控制台发现每个例子的布局都很奇怪。正常情况下我们写一个局部滚动，代码应该是这样的。

<iframe src="https://codesandbox.io/embed/boring-lehmann-kwve4?fontsize=14&hidenavigation=1&theme=dark" title="awesome-mestorf-nb8r2" allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media" style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"></iframe>

可是这个库的布局是这样的

<iframe src="https://codesandbox.io/embed/practical-blackburn-qmf1w?fontsize=14&hidenavigation=1&theme=dark" title="awesome-mestorf-nb8r2" allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media" style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"></iframe>

内层元素是以绝对定位+translate的方式“贴”上去的，比起普通的流式布局，这样做的好处是一旦周围的元素有变化（位置变化或者干脆从dom树中删除），主体元素的位置不会变化。我们可以利用这一特性，在页面初始化中只渲染能覆盖一屏的元素个数（假如是15个），在滚动容器的过程中，势必有一些元素滚出屏幕（A），又有新的元素将要出现在屏幕内（B），我们重复利用滚出屏幕的废弃元素（A），改变他们的translate，使其出现在B应该出现的位置，然后改变B的数据。这样即使有成千上万条数据，渲染在容器内的dom也仅仅只有15个（可能大于15，只有B的个数大于A的个数时，才会createElement）。这就是核心所在。

回到官方的两列瀑布流例子

![](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/%E5%8A%A8%E7%94%BB.gif?versionId=CAEQGxiBgICh8q_s5xciIGI0MWQyYTQ3MDdiZDRlZGI4YTViYWY1YjNlZDM2NTYy)

从图中可以看出变化的仅仅是translate，外层recycler-scroller的最大滚动高度很大，随着页面的滚动，可见的元素仅仅是那几个被反复利用的元素，其实recycler-scroller下部有大片看不到的空白，实际高度是由一个宽高都为1的绝对定位元素（sentine）撑开的，这个元素的top便是scroller的最大滚动高度。

![d8fd84a1-1504-4020-93f7-a550314c1459-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/d8fd84a1-1504-4020-93f7-a550314c1459-image.png)

为啥有个container，以我的理解，从这个库的原理来看，container的作用仅仅是区分可见元素的dom与sentine，方便管理（比如说往container里面append元素）。
# 具体的代码实现

## 整体设计
从dom结构来看，整个库分为三部分：Scroller = Containe + Sentine。

从代码层次来看，整个库分为Recyler、Render与Source。Recyler是核心实现，Render负责dom的创建/更新以及不可见元素的回收利用。Source顾名思义数据之源，由于这个库的原理所限，每项数据必须提供height与scrollTop。

## 单行代码分析

首先入口文件是waterfail.js
```typescript
export default function getWaterfallRecycler(scroller, container) {
  return new Recycler(scroller, new WaterfallSource(), {
    container,
    renderer: new NumberRenderer()
  });
}
```
需要一个提供数据与每项数据的位置参数的Source实例，需要一个提供每项元素具体render实现以及回收/释放屏幕外元素的Render实例，需要一个产生滚动的的滚动容器（scroller），以及用于管理屏幕内（准确说应该是当下渲染出的元素）的元素。

接下来看Recycler的具体实现。

```typescript
class Recycler<T> extends EventEmitter implements IRecycler<T>{}
```
EventEmitter是一个简短的消息发射器，用于向外界通知Recycler的各种情况，比如说是否正在滚动以及是否滚到了底部。

我基于作者的注释给与补充

```typescript
class Recycler<T> extends EventEmitter implements IRecycler<T>{
    constructor(scroller: Window | HTMLElement, sources: ISource<T> | Array<ISource<T>>, options: IOptions<T>) {
        super();

        // 初始化统一 scroller 操作接口
        this.scrollerOperations = new ScrollerOperations(scroller);
        // 滚动元素可以是普通的dom，也可以是window，这个类抹平了两者的差异。
        
        
        if (!this.scrollerOperations.isScrollerValid()) {
            throw Exceptions.TypeError('Invalid scroller, must be window or inside document.body');
        }

        // 滚动容器
        this.scroller = scroller;
        this.scrollerHeight = this.scrollerOperations.getOffsetHeight();
        // scrollerHeight即scroller的offsetHeight，具体到这个例子上，即recycler-scroller的offsetheight calc(100% - 60px)

        // 默认渲染器
        this.renderer = options.renderer;

        // 容纳元素的容器
        this.container = options.container || this.scrollerOperations.getElement();

        // 顶部和底部预留空间
        this.topPreserved = Math.max(options.topPreserved || 0, 0);
        this.bottomPreserved = Math.max(options.bottomPreserved || 0, 0);
        // 这两项是为了适应scroller顶部或底部有额外元素的情况

        // 滚动正反方向预渲染元素个数
        this.runwayItems = options.runwayItems || 5;
        this.runwayItemsOpposite = options.runwayItemsOpposite || 2;
        //在滚动过程中，我们看到的container里面元素的覆盖面不止一屏的高度，应该加上runwayItems与runwayItemsOpposite个元素的高度，之所以设计这两个参数，我猜是为了竟可能的减少白屏时间。

        // 距离底部多少个元素时触发加载更多
        this.threshold = options.threshold || 5;
        // 这个底部指的是具有实际滚动高度的scroller的底部，而不是看到的container

        // 允许多个实例，可以在实例之间切换（为了能在同一个 scroller 中切换不同的内容，比如搜索结果和原列表之间切换）
        this.initRunways(sources);
        this.activatedRunway = Recycler.getDefaultRunwayKey(sources);
        // 作者设计这个runway可能真由他所说，用于在同一个scroller中切换不同的内容，但是初次阅读源码这个概念反而成为一种干扰，所以可以先认为runway就是一个保存了滚动过程中各种重要参数的对象。
        // 稍后会介绍runway
        
        // 初始化 Dom 事件监听器
        this.scrollListener = new ScrollListener(this.scroller);
        this.resizeListener = new ResizeListener();

        // 撑开滚动容器
        this.sentinel = document.createElement('div');
        this.sentinel.style.position = 'absolute';
        this.sentinel.style.width = '1px';
        this.sentinel.style.height = '1px';
        this.scrollerOperations.appendChild(this.sentinel);
        // scroller = container + Sentine，container里面的元素全部绝对定位，container本身是没有高度的，但是scroller却能滚动，原因就是内部有一个top很大的绝对定位元素撑开的，而这个元素的top就是由每一项数据的height计算得知的。

        // 根据是否启用硬件加速选择模板
        if (options.enableAcceleration) {
            this.transformTemplate = (x, y) => `translate3d(${x}, ${y}px, 0)`;
        } else {
            this.transformTemplate = (x, y) => `translate(${x}, ${y}px)`;
        }
        

        // 初始化 container position style
        if (window.getComputedStyle(this.container).position === 'static') {
            this.container.style.position = 'relative';
        }

        // 初始化哨兵位置
        this.setSentinelPosition();
        //给Sentine元素设置top值，以便撑开scroller

        // 监听事件，根据 scroller 需要不同的监听方式
        this.scrollListener.on(this.onScroll.bind(this));
        // 监听scroller的滚动事件，以便实时的渲染屏幕内的元素、回收屏幕外的元素，所以this.onScroll做的事很关键。
        if (options.handleWindowResize) {
            this.resizeListener.on(this.onResize.bind(this));
        }

        // 遍历 runways，并调用对应的 source.mount() 方法，可以在此监听一些事件（比如配置 lazyload）
        mapObject(this.runways, (runway) => {
            execute(() => runway.source.mount(this));
        });
        // 可以跳过这一句

        // 渲染视图（如果 sources 不为空的话）
        if (this.getRunway().source.getLength(this) > 0) {
            this.update();
        }
        // 如果数据不为空的话，渲染出第一屏数据，this.update内部会调用this.onScroll

        // 调用 onInitialized
        setTimeout(() => this.emit(Recycler.Events.Initialized, this));
        //通知外界框架已经初始化完毕，并渲染出第一屏数据。
    }
    
}
```
接下来说明constructor中几个重要的步骤。
```typescript
this.initRunways(sources);
this.activatedRunway = Recycler.getDefaultRunwayKey(sources);
```
initRunways调用了addRunway,addRunway调用了getInitialRunway。
```typescript
protected static getInitialRunway<U>(source: ISource<U>): IRunway<U> {
    return {
      scrollTop: 0,
      firstAttachedItem: 0, 
      lastAttachedItem: 0,
      firstScreenItem: 0,
      lastScreenItem: 0,
      requestInProgress: false,
      runwayMaxScrollTop: 0,
      nodes: {},
      screenNodes: newSet(),
      source,
    };
  }
```
代码很明显，runway就是一个保存了在滚动过程中几个比较重要参数的对象。

scrollTop：scroller的scrollTop

requestInProgress：是否正在请求数据，

nodes：渲染出来的元素集合（不仅仅是屏幕内的元素）

screenNodes：nodes的缓存

runwayMaxScrollTop：scroller的最大滚动高度，即Sentine的top值，可以由source的height计算得出。

至于firstAttachedItem/lastAttachedItem/firstScreenItem/lastScreenItem这两对的意思？？为什么是两对，这个后面会解释，这里认为只有一对好了，即firstScreenItem/lastScreenItem，意思是把source中的哪几项渲染到container内。

这样，initRunways的意思是初始化了这样一个对象，至于activatedRunway暂且跳过。

```typescript
this.update()
```
```typescript
public update(disableRender?: boolean) {
    this.scrollerHeight = this.scrollerOperations.getOffsetHeight();
    this.getRunway().runwayMaxScrollTop = this.getRunwayMaxScrollTop();
    this.setSentinelPosition();
    this.emit(Recycler.Events.Update, this, disableRender);
    !disableRender && this.onScroll();
  }
```
upadte内部首先算出scroller的滚动高度，调用setSentinelPosition，然后手动调用onScroll方法渲染出第一屏元素。所以关键是onScroll的实现。

[onScroll](https://github.com/hdcoo/recycler-view/blob/master/src/Recycler.ts#L285)

去繁从简,onScroll干的事首先算出在当前滚动中应该被渲染元素的索引（先不考虑具体的实现），然后根据滚动的方向调用fill方法渲染html

[fill](https://github.com/hdcoo/recycler-view/blob/master/src/Recycler.ts#L332)

```typescript
const fixedStart = Math.max(0, start);
const fixedEnd = Math.min(runway.source.getLength(this) - 1, end);
```
这两句很疑惑，为什么要重新计算start和end呢

![d23cee97-7080-4a8f-89b0-24e87b67e522-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/d23cee97-7080-4a8f-89b0-24e87b67e522-image.png)

![](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/%E5%8A%A8%E7%94%BB2.gif?versionId=CAEQGxiBgIC7n4v85xciIDNhYjIwMTQ3YTZlOTQ5MmFiMGMzZTU3ZWE5OWZlNmZh)

从图中可以看出由于runwayItemsOpposite与runwayItems的存在，算出来的start可能小于0，end可能大于source的最大长度，所以需要重新计算，这就是为什么initRunway方法里面有两对关于start、end的值的原因。

算出正确的start、end后调用了attachContent。

attachContent分两步：

1. 根据start、end释放屏幕外的元素。这里有两步，首先更新runway.nodes与runway.screenNodes，screenNodes是nodes的缓存，这俩货只负责渲染container内部的元素，实现dom的重复利用的是renderer.release方法。

```typescript
public release(el: HTMLElement, recycler: IRecycler<T>): void {
    this.queue.using.delete(el);
    this.queue.unused.push(el);
  }
```
调用release方法时缓存了废弃的元素。

2. 渲染当前滚动屏幕内的元素。

```typescript
protected attachContent(start: number, end: number) {
    const runway = this.getRunway();
    const benchNodes = []; // 板凳元素，即等待被放到 DOM tree 里的节点
    const changedNodes: IChangedNodes = []; // 有变化的节点

    // 重点是释放在屏幕外的元素
    this.freeUnusedNodes(start, end, this.isForceUpdate);

    // 从渲染起始点到渲染终止点进行遍历
    for (let i = start; i <= end; i++) {
      // 如果 node 存在于缓存中，说明元素本来就在屏幕上，不需要做什么（除非指定强制更新）
      if (!this.isForceUpdate && runway.nodes[i]) {
        continue;
      }

      const renderer = this.getRenderer(i);
      const data = runway.source.getData(i, this);

      // 调用渲染函数，获得一个节点
      // 这个节点可能在屏幕上，也可能不在，取决于渲染器的设计（是否有缓存）和当前滚动的深度
      // 如果该节点在屏幕上，性能会最佳，因为只需要改变一下 translate 就行了，不需要 layout
      const node = runway.nodes[i] = renderer.render(data, this);

      // 向缓存中存入一个节点，用于移除
      runway.screenNodes.add(node);

      // 向变化的节点数组中加入一项，等待改变样式（translate, height, etc...）
      changedNodes.push({node, index: i});

      // 如果该节点的父元素不是指定的容器，则加入板凳元素数组中
      if (node.parentNode !== this.container) {
        benchNodes.push(node);
      }
    }

    // 批量修改节点样式
    this.setNodesStyles(changedNodes);

    // 批量加入元素到容器中
    while (benchNodes.length) {
      this.container.appendChild(benchNodes.pop());
    }

    // 也许可以加载更多
    this.maybeLoadMore(end);
  }
```
这几行代码算是比较核心的实现。如果runway.nodes[i]存在，则不渲染，即使不存在，会调用renderer.render方法，这个方法会优先从render的缓存中pop一个元素出来，改变它的translate和data从而实现dom的重复利用。

并且为了更高的性能，定义了changedNodes与benchNodes，前者包含当次滚动中需要渲染的所有元素（缓存中的元素+新创建的元素），后者仅仅是新创建的元素，这样仅仅只需要改变前者的transtrate，把后者append到container中就可以了。

这样，整个流程便走完了，后面在scroller滚动过程中会反复调用this.onScroll，思路和上面的一样。

# 简短的流程
去繁从简，从构造函数开始，整个流程如下：
constructor -> this.update() -> this.onScroll() -> (this.getFirstScreenItem;this.getLastScreenItem,计算出理论上container内渲染元素的start、end索引) -> (this.fill(),计算出实际的start、end索引) -> (this.attachContent(),准备根据start、end更新container内的元素)

把attachContent单拎出来。

this.attachContent() -> (this.freeUnusedNodes(),释放屏幕外的元素，其实是放入render的unused中) -> (渲染屏幕内的元素)

再过滤一遍，核心实现就三步：
1. 依据上次的start、end计算本次的start、end (getFirstScreenItem、getLastScreenItem)
2. 依据start、end释放屏幕外的元素
3. 依据start、end更新屏幕内的元素

```typescript
protected getFirstScreenItem(initialAnchorItem: number, scrollTop: number): number {
    let i = initialAnchorItem;
    const runway = this.getRunway();
    const sourceLastIndex = runway.source.getLength(this) - 1;
    // 本次scrollTop大于上次firstScreenItem对应的scrollTop，所以是往下滚
    if (runway.source.getScrollTop(i, this) + runway.source.getHeight(i, this) < scrollTop) {
        //从上一次firstScreenItem的下一个元素开始往后遍历，一直找到scrollTop大于当前scrollTop的元素索引
        while (i < sourceLastIndex && runway.source.getScrollTop(++i, this) + runway.source.getHeight(i, this) <= scrollTop) {
            // do nothing
        }
    } else {
        // 逻辑与往上滚动相反
        while (i > 0 && runway.source.getScrollTop(--i, this) + runway.source.getHeight(i, this) > scrollTop) {
            // do nothing
        }
        // 上面的循环得到的 i 的意义是在屏幕之上的最后一个元素
        // 我们需要的是 在屏幕内的第一个元素
        // 故加 1
        i < sourceLastIndex && i > 0 && ++i;
    }

    return i;
}
```
```typescript
protected getLastScreenItem(initialAnchorItem: number, scrollTop: number): number {
    // 这里的scrollTop是scroller的scrollTop + scroller的offsetHeight
    let i = initialAnchorItem;
    const runway = this.getRunway();
    const sourceLastIndex = runway.source.getLength(this) - 1;
    // 如果是往上滚
    if (runway.source.getScrollTop(i, this) > scrollTop) {
        // 从上一次的lastScreenItem的上一个元素往前遍历，一直找到scrollTop小于当前scrollTop的元素索引
      while (i > 0 && runway.source.getScrollTop(--i, this) >= scrollTop) {
        // do nothing
      }
    } else {
        // 逻辑与往上滚相反
      while (i < sourceLastIndex && runway.source.getScrollTop(++i, this) < scrollTop) {
        // do nothing
      }
      // 上面的循环得到的 i 的意义是首个 scrollTop >= 给定 scrollTop 的 item
      // 我们需要的是 最后一个 scrollTop <= 给定 scrollTop 的 item
      // 故减 1
      i > 0 && i < sourceLastIndex && --i;
    }

    return i;
  }
```
```typescript
protected freeUnusedNodes(start: number, end?: number, force?: boolean) {
    const runway = this.getRunway();
    if (force || start > runway.lastAttachedItem || end < runway.firstAttachedItem) {
      return this.freeNodesFromStart(runway.firstAttachedItem, Math.min(runway.source.getLength(this), runway.lastAttachedItem + 1));
    }
    // 可能处理某种边界情况

    this.freeNodesFromStart(runway.firstAttachedItem, start);
    this.freeNodesFromEnd(end, runway.lastAttachedItem);
  }
```
这个方法比较简单，依次释放屏幕上次边界以外的元素，释放方法就是使用for循环依次放入render的unused中。

最后就是更新屏幕内的元素，更新方法是优先复用render的unused中的元素，仅仅改变他们的translate，不会引起重排，如果item很复杂的话，render.update方法也会消耗性能，但这是外部控制的。如果render.unused中没有元素，则需要createDom（与render.update类似） -> appendDom，除了首次渲染，不会出现高频appendDom的情况。

所以就库本身来说，性能还是挺高的。

最后，由于这个库的特殊布局，它能实现很多种UI效果，普通的多列、甚至复杂的多列瀑布流。不足的地方就是每个item都需要知道height与scrollTop。













