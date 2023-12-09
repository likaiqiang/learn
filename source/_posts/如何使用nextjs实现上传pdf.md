---
title: 如何使用nextjs实现上传pdf
date: 2023-12-09 14:21:53
tags:
---
之前研究gpt4-pdf-chatbot-langchain这个项目，觉得挺有意思，竟然可以让chatgpt去读一本书，还是js写的。不过这项目有一点不方便，他需要用nodejs解析pdf，然后用openai提供的api把api向量化，接着在浏览器里才能基于这本书的内容向chatgpt提问。

然后我就想能不能把所有的操作入口都放在浏览器上，在浏览器上上传一个pdf，然后后端拿到上传的pdf，解析pdf，向量化，后面的操作和原项目一样。基于这样的想法，我写了以下的代码。

```javascript
//pages/index.tsx
function App(){
    const onFileUplload = e=>{
        const file = event.target.files?.[0]
        const formData = new FormData()
        formData.append('file', file)
        return fetch('/api/upload',{
            method:'post',
            body: formData,
        }).then((resp)=> {
            if(resp.status !== 200) return Promise.reject(resp.statusText)
            return resp.json()
        })
    }
    return (
        <div>
            <input id='dropzone-file2' type="file" onChange={onFileUplload} accept=".pdf"/>
        </div>
    )
}
```
```javascript
//pegae/api/upload.ts
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,

){
    const buffer =  Buffer.from(req.body)
    console.log(buffer);
    // 处理buffer，解析pdf
}

export const config = {
    api:{
        bodyParser: {
            sizeLimit: '10mb'
        }
    }
}
```
以上代码后续在解析pdf的过程中报错了，说我的pdf是加密的，很明显不是这个原因。经过一番查找发现，发现用以上代码拿到的buffer与直接用nodejs读pdf拿到的buffer长度不一样。

buffer from browser upload
![839ccc20-58c2-4830-94fb-f1ed9af5d960-buffer_from_upload.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/839ccc20-58c2-4830-94fb-f1ed9af5d960-buffer_from_upload.png)

buffer from nodejs
![5a5738e6-2085-4381-953b-173466716bd9-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/5a5738e6-2085-4381-953b-173466716bd9-image.png)

显然，[buffer from browser upload]有问题，那这一步的buffer是从哪里来的，const buffer =  Buffer.from(req.body)，把这里的req.body打印出来看看，发现是个乱码的字符串，很明显不对，后续再把这个错误的字符串转换成buffer，后面的一系列步骤都错了。

这个错误到底是怎么来的，怎么会拿到一个乱码的字符串呢？那就从源头查起， 我们知道浏览器上的http请求，不管请求体中是什么数据，最终都会转化为二进制，就是所谓的数字信号，然后数电转模电，单纯的数字信号是不能发射的，只能转换成模拟信号，就是我们说的波，发射出去。目标服务器在接收到这个波以后，需要把模拟信号转换成数字信号，就是二进制，然后才能处理这条http请求。数电模电之间的转换是不可能出错的，按照以上理论，我们在服务端拿到的这条请求应该是个二进制流才对，为什么会是乱码的字符串呢，所以，最大的可能就是nextjs处理了这个二进制流，但是没有处理好。所以我们需要拿到原始的二进制流。
```javascript
import { getBoundary, parse } from 'parse-multipart-data'
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,

){
    const chunks: Uint8Array[] = []
    let size = 0
    const sizeLimit = 10 * 1024 * 1024

    req.on('data',(chunk)=>{
        size += chunk.length
        if(size > sizeLimit){
            res.status(413).send('payload too large')
            req.connection.destroy()
            return
        }
        chunks.push(chunk)
    })
    req.on('end',async ()=>{
        const boundary = getBoundary(req.rawHeaders.join(';'))
        const completeBuffer = Buffer.concat(chunks)
        const parts = parse(completeBuffer, boundary)
        const [file] = parts
        console.log('file.data',file.data);
    })
    req.on('error',e=>{
        console.log(e)
        res.status(500).send('an error occurred')
    })
}

export const config = {
    api:{
        bodyParser: false
    }
}
```
代码一目了然，先禁掉nextjs内置的bodyParser，直接监听req的data与end事件，收集chunk，然后通过getBoundary与parse从formdata中解析出file，这里log出的file.data就是正确的数据，长度是1086938。

拿到正确的buffer以后就可以调用pdf-parser解析了。



