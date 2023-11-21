---
title: RN通过Android Intent打开媒体及播放!
date: 2023-11-21 20:24:56
tags:
---

最近在阅读lx-music-mobile的代码，原作者代码写的很好，我在他的基础上增加了下载与本地音乐播放功能，原作者不实现肯定有他的考虑，我恰好有这个需求而已。

以上功能完成以后，我就想着能不能进一步直接在文件管理器中用lx.music打开某音乐，经过一番研究，发现在AndroidManifest.xml加上这些代码:
```xml
<activity>
    //...
    <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <category android:name="android.intent.category.APP_MUSIC"/>
        <data android:mimeType="audio/*"/>
        <data android:mimeType="application/ogg"/>
        <data android:mimeType="application/x-ogg"/>
        <data android:mimeType="application/itunes"/>
        <data android:scheme="content"/>
        <data android:scheme="file"/>
    </intent-filter>
    //...
</activity>
```
在文件管理器里面打开某音乐时，lx.music就会出现在可选择列表里。这样点击lx.music仅仅会唤起app而已，后面还需要实现“响应这个操作并播放音乐文件”。

先说一下这个intent，以我的初步理解，这东西是android内部不同app之间进行通讯的，在文件管理器打开音乐文件时发送了一个intent，lx.music匹配到这个intent（参见intent-filter的规则）后，需要解析出intent里面的内容，由于播放器的逻辑是rn实现的，所以需要给rn发送一个事件，js那边通过DeviceEventEmitter监听这个事件拿到音乐文件真实的路径。

这里的顺序很重要，需要js先通过DeviceEventEmitter监听这个事件，然后android发送这个事件，js那边才能收到。

app冷启动时，首先启动MainActivity，依次执行onCreate onStart onResume这些生命周期，然后加载并执行js代码，执行完毕后，会初始化reactContext对象。在onCreate onStart onResume这些生命周期里是拿不到reactContext的，所以就需要这样的代码:
```java
class MainActivity{
    @Override
    protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        final ReactInstanceManager reactInstanceManager = ((MainApplication) getApplication()).getReactNativeHost().getReactInstanceManager();
        reactInstanceManager.addReactInstanceEventListener(new ReactInstanceManager.ReactInstanceEventListener() {
          @Override
          public void onReactContextInitialized(ReactContext context) {
            reactContext = context;
          }
        });
        if (reactInstanceManager.hasStartedCreatingInitialContext()) {
          reactContext = reactInstanceManager.getCurrentReactContext();
          // ReactContext已经创建完成，可以直接获取
        }
    }
}
```
reactContext不为null，说明js代码执行完毕，在android端执行:
```java
reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("onPathReceived", event);
```
在js端，通过以下代码接收这个消息:
```javascript
const eventListener = DeviceEventEmitter.addListener('onPathReceived', eventParams => {
    //
});
```
值得注意的是，刚才说android会在js执行完毕后初始化reactContext对象，这里的“执行完毕”具体指的是什么，都执行了哪些代码。假如是在浏览器上，一个标准的react组件:
```javascript
const app = ()=>{
    useEffect(()=>{
        //...
    },[])
    return (
        <div>a page</div> 
    )
}
```
这个组件是如何渲染到浏览器上的？首先会执行render函数，把虚拟dom转换成真实的dom挂载到浏览器上，dom只是浏览器内部的一种数据结构，真正把画面渲染出来是浏览器做的工作，浏览器渲染完毕，会执行useEffect的回调函数。

在react-native上，js的宿主环境不是浏览器，渲染工作是由原生完成的，由此可见，上面说的“执行完毕”仅仅执行了render函数，所以不能把DeviceEventEmitter.addListener放在useEffect里面，应该更提前，比如放在组件外面:
```javascript
const eventListener = DeviceEventEmitter.addListener('onPathReceived', eventParams => {
    global.event.emit('onPathReceived',eventParams.path)
});
const app = ()=>{
    useEffect(()=>{
        global.event.on('onPathReceived',path=>{
            
        })
    },[])
    return (
        <div>a page</div> 
    )
}
```
这样又带来一个问题，当onPathReceived触发时，很可能涉及音乐播放的组件还没有渲染（比如有的组件是动态加载的），即使发射了onPathReceived事件，也没有任何响应，这里可以设置一个缓存，比如这样:
```javascript
class Event {
  cache: Map<string, Array<any>>

  constructor() {
    super()
    this.cache = new Map()
  }

  on(eventName: string, listener: (...args: any[]) => any) {

    // 检查缓存中是否有提前 emit 的事件
    let cachedEvents = this.cache.get(eventName)
    if (cachedEvents) {
      for (let args of cachedEvents) {
        listener(...args)
      }
      this.cache.delete(eventName)
    }
  }

  emit(eventName: string, ...args: any[]) {

    // 如果没有监听器，将事件保存到缓存中
    if (!this.listeners.has(eventName)) {
      let cachedEvents = this.cache.get(eventName)
      if (!cachedEvents) this.cache.set(eventName, cachedEvents = [])
      cachedEvents.push(args)
    }
  }

}
```
这样就ok了。



