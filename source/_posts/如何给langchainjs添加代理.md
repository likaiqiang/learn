---
title: 如何给langchainjs添加代理
date: 2023-12-12 19:42:10
tags:
---

langchain这个框架是个好东西，本以为又是python的天下，没想到竟然有js版本，不过openai毕竟是国外的嘛，能否配置代理对我们这些渴望高质量服务的国人来说至关重要。

你要是用clash，这个软件有个虚拟网卡模式，开启后，电脑上的所有流量都会走这个虚拟网卡，但是毕竟是国人，老是开虚拟网卡有点不方便。

langchainjs更新很快，老版本可以用以下的方式配置proxy。
```javascript
const llm = new OpenAI(
    {
      openAIApiKey: '',
      // modelName: 'gpt-3.5-turbo',
      modelName: 'text-davinci-003',
      // modelName: 'code-davinci-002',
      // modelName: 'code-davinci-001',
      // modelName: 'gpt-4',
      temperature: 0,
      verbose: true,
    },
    {
      baseOptions: {
        proxy: false,
        httpAgent: new HttpsProxyAgent('http://a:30010'),
        httpsAgent: new HttpsProxyAgent('http://a:30010'),
      },
    }
  );
```
这种方式已经失效了（0.0.198），新版本推荐以下的方式配置代理
```javascript
const model = new ChatOpenAI({
    temperature: 0, // increase temperature to get more creative answers
    modelName: 'gpt-3.5-turbo',
    openAIApiKey: '',
    //change this to gpt-4 if you have access
},{
    httpAgent: new HttpsProxyAgent(proxy)
});
```
不过就我用的node18.16.0来说，以上方式并不生效，为此，我大概翻了一下langchain的代码，并且找到了原因。

[embeddings.ts L258](https://github.com/langchain-ai/langchainjs/blob/0.0.198/libs/langchain-openai/src/embeddings.ts#L258)。以我用的embedding api为例子，看一下langchian内部是如何发起网络请求的，await this.client.embeddings.create这一句，这里的this.client是怎么来的，243行，this.client = new OpenAIClient(params)，这里的OpenAIClient是openai这个js库导出的，所以langchianjs内部实际上调了openai-node。

[openai-node L480](https://github.com/openai/openai-node/blob/v4.20.1/src/core.ts#L480) 这里的fetch来自this.getRequestClient()，487行，getRequestClient返回的fetch来自this.fetch，184行，this.fetch = overridenFetch ?? fetch，这里的overridenFetch是个实例参数，一般不会传的，所以最终的fetch来自[_shims
/index.js](https://github.com/openai/openai-node/blob/v4.20.1/src/_shims/index.js) 。

```javascript
/**
 * Disclaimer: modules in _shims aren't intended to be imported by SDK users.
 */
const shims = require('./registry');
const auto = require('openai/_shims/auto/runtime');
if (!shims.kind) shims.setShims(auto.getRuntime(), { auto: true });
for (const property of Object.keys(shims)) {
  Object.defineProperty(exports, property, {
    get() {
      return shims[property];
    },
  });
}
```
这几行代码其实不复杂，registry里面导出了一堆需要shims的方法或者属性，也包括fetch，这些东西最终会通过那个for循环+Object.defineProperty导出给外部使用，可以通过shims.setShims给这些方法或者属性打补丁。看看auto.getRuntime()的实现。

[web-runtime.ts L20](https://github.com/openai/openai-node/blob/v4.20.1/src/_shims/web-runtime.ts#L20) 20行这里的fetch赋值找不到定义，说明最终发起网络请求的fetch来自运行这段js的环境。

我们知道fetch这个api是浏览器上用来替代XMLHttpRequest的，node环境想用一直用node-fetch这个库，但是从node18开始也实现了原生的fetch，，所以这就是httpAgent不生效的原因，因为nodejs18内置的fetch根本不支持传递httpAgent参数。它通过以下的方式配置代理。
```javascript
import { ProxyAgent } from 'undici'
const dispatcher = new ProxyAgent('https://proxy.com')


const r = await fetch('google.com', { 
         dispatcher,
         method: 'POST',
         body: JSON.stringify({ hi: "mom" })
})
```
很明显，这个dispatcher选项langchainjs没有给我们提供，那怎么办呢，我们可以通过刚才的overridenFetch覆盖掉默认的fetch检测，而这个参数langchainjs提供了。

[embeddings.ts](https://github.com/langchain-ai/langchainjs/blob/0.0.198/libs/langchain-openai/src/embeddings.ts#L243) 这里的configuration类型是ClientOptions，而ClientOptions来自openai-node，[fetch option](https://github.com/openai/openai-node/blob/v4.20.1/src/index.ts#L49) 这里的fetch就是上面说的overridenFetch，可以给这个参数赋值node-fetch，然后httpAgent参数就起作用了。所以最终的代码:

```javascript
import fetch from 'node-fetch'
new ChatOpenAI({
    temperature: 0, // increase temperature to get more creative answers
    modelName: 'gpt-3.5-turbo',
    openAIApiKey: ''
    //change this to gpt-4 if you have access
},{
    httpAgent: new HttpsProxyAgent(proxy),
    fetch
})
```






