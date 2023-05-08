---
title: webpack常见loader工作原理
date: 2023-05-08 15:13:26
tags:
---
# file-loader与url-loader
这俩loader就是纸老虎，曾经老有面试问这俩loader的区别，每次都去记😂，其实只要看看他俩的源码就明白了。先来一个简单的例子
```javascript
//webpack.config.js
require('@babel/register')({
    presets: ['@babel/preset-env']
});
module.exports = {
    entry: './src/index.js',
    //...
    module:{
        rules:[
            {
                test: /\.(png|jpe?g|gif)$/i,
                use: [
                    {
                        loader: path.resolve(__dirname,'./src/loaders/file-loader/cjs.js')
                        // 这里我为了方便调试，copy了file-loader的源码
                    }
                ]
            }
        ]
    }
    //...
}
//./src/index.js
const imgUrl = require('./images/test.png')
console.log('imgUrl',imgUrl);
```
还需要配置一下debug环境，我用的是webstorm，其他ide同理，能调试node就能调试webpack-loader。

![62a133e5-68a4-4075-9139-6fa14982d7fb-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/62a133e5-68a4-4075-9139-6fa14982d7fb-image.png)

最后进入正文，在[loader函数](https://github.com/webpack-contrib/file-loader/blob/master/src/index.js#L10) 这里打个断点，就可以看file-loader的执行过程了。

```javascript
export default function loader(content) {
  const options = getOptions(this); //这里拿到的options就是webpack配置文件file-loader那里传过来的options，我们这里为空

  validate(schema, options, {
    name: 'File Loader',
    baseDataPath: 'options',
  });
  // 验证options合法性

  const context = options.context || this.rootContext; //这不重要
  const name = options.name || '[contenthash].[ext]'; //这是个模板字符串，后续会根据实际替换中括号里的值

  const url = interpolateName(this, name, {
    context,
    content,
    regExp: options.regExp,
  }); //interpolateName这个函数会根据资源的原始信息替换掉name里的模板，最后生成一个处理过的资源名称，类似c04dc325df0375584b.png
    // 这里知道作用就可以了，先略过

  let outputPath = url;

  if (options.outputPath) { // 我们的options里面啥都没有，这句不会执行
    if (typeof options.outputPath === 'function') {
      outputPath = options.outputPath(url, this.resourcePath, context);
    } else {
      outputPath = path.posix.join(options.outputPath, url);
    }
  }

  let publicPath = `__webpack_public_path__ + ${JSON.stringify(outputPath)}`;
  // 这个publicPath最后会被return，之所以在前面拼个__webpack_public_path__是因为__webpack_public_path__是webpack暴露的全局变量，代表publicPath

  if (options.publicPath) { //这句也不执行
    if (typeof options.publicPath === 'function') {
      publicPath = options.publicPath(url, this.resourcePath, context);
    } else {
      publicPath = `${
        options.publicPath.endsWith('/')
          ? options.publicPath
          : `${options.publicPath}/`
      }${url}`;
    }

    publicPath = JSON.stringify(publicPath);
  }

  if (options.postTransformPublicPath) { //这句也不会执行
    publicPath = options.postTransformPublicPath(publicPath);
  }

  if (typeof options.emitFile === 'undefined' || options.emitFile) {//这句执行了
    const assetInfo = {};

    if (typeof name === 'string') {
      let normalizedName = name;

      const idx = normalizedName.indexOf('?');

      if (idx >= 0) {
        normalizedName = normalizedName.substr(0, idx);
      }

      const isImmutable = /\[([^:\]]+:)?(hash|contenthash)(:[^\]]+)?]/gi.test(
        normalizedName
      );

      if (isImmutable === true) {
        assetInfo.immutable = true;
      }
    }

    assetInfo.sourceFilename = normalizePath(
      path.relative(this.rootContext, this.resourcePath)
    );
    // 上面那一坨先不用看，关键是这个emitFie方法，文档在这里https://webpack.docschina.org/api/loaders/#thisemitfile
    this.emitFile(outputPath, content, null, assetInfo);
  }
    //最后return了一个这样的结果 module.exports = __webpack_public_path__ + "c04dc325df0375584b1fcd56895e3c6f.png"
  const esModule =
    typeof options.esModule !== 'undefined' ? options.esModule : true;

  return `${esModule ? 'export default' : 'module.exports ='} ${publicPath};`;
}
```
由于这个例子的options是空，所以省略了很多代码，这是省略后的file-loader
```javascript
const options = getOptions(this);

validate(schema, options, {
    name: 'File Loader',
    baseDataPath: 'options',
});

const context = options.context || this.rootContext;
const name = options.name || '[contenthash].[ext]';

const url = interpolateName(this, name, {
    context,
    content,
    regExp: options.regExp,
});
let outputPath = url;
let publicPath = `__webpack_public_path__ + ${JSON.stringify(outputPath)}`;

this.emitFile(outputPath, content, null, assetInfo);
const esModule =
    typeof options.esModule !== 'undefined' ? options.esModule : true;

return `${esModule ? 'export default' : 'module.exports ='} ${publicPath};`;
```
这几行代码体现除了file-loader都干了些什么，其实关键点就两步，首先通过interpolateName编译name，然后通过this.emitFile把原始资源copy到dist，顺便把名字改成编译后的name，完了。

接下来看[url-loader](https://github.com/webpack-contrib/url-loader/blob/master/src/index.js) 这个代码更简。
```javascript
export default function loader(content) {
  // Loader Options
  const options = getOptions(this) || {};

  validate(schema, options, {
    name: 'URL Loader',
    baseDataPath: 'options',
  });

  // No limit or within the specified limit
  if (shouldTransform(options.limit, content.length)) {
    const { resourcePath } = this;
    const mimetype = getMimetype(options.mimetype, resourcePath);
    const encoding = getEncoding(options.encoding);

    if (typeof content === 'string') {
      // eslint-disable-next-line no-param-reassign
      content = Buffer.from(content);
    }

    const encodedData = getEncodedData(
      options.generator,
      mimetype,
      encoding,
      content,
      resourcePath
    );

    const esModule =
      typeof options.esModule !== 'undefined' ? options.esModule : true;

    return `${
      esModule ? 'export default' : 'module.exports ='
    } ${JSON.stringify(encodedData)}`;
  }

  // Normalize the fallback.
  const {
    loader: fallbackLoader,
    options: fallbackOptions,
  } = normalizeFallback(options.fallback, options);

  // Require the fallback.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const fallback = require(fallbackLoader);

  // Call the fallback, passing a copy of the loader context. The copy has the query replaced. This way, the fallback
  // loader receives the query which was intended for it instead of the query which was intended for url-loader.
  const fallbackLoaderContext = Object.assign({}, this, {
    query: fallbackOptions,
  });

  return fallback.call(fallbackLoaderContext, content);
}
```
上面那一大堆，关键步骤还是两点，一个是shouldTransform，一个是normalizeFallback。

shouldTransform，顾名思义，是否把文件转成base64。
```javascript
function shouldTransform(limit, size) {
  if (typeof limit === 'boolean') {
    return limit;
  }

  if (typeof limit === 'string') {
    return size <= parseInt(limit, 10);
  }

  if (typeof limit === 'number') {
    return size <= limit;
  }

  return true;
}
```
从代码来看，limit可以直接是true/false，或者是字符串或者数字，如果是字符串会调parseInt转成数字，逻辑都一样 size <= limit。

如果满足shouldTransform，会调用getEncodedData把文件转成base64。

接下来是normalizeFallback

[normalizeFallback](https://github.com/webpack-contrib/url-loader/blob/master/src/utils/normalizeFallback.js#L3) 看到没有函数内第一行let loader = 'file-loader';
再回到url-loader
```javascript
 const fallback = require(fallbackLoader); //这里的fallback就是file-loader

// Call the fallback, passing a copy of the loader context. The copy has the query replaced. This way, the fallback
// loader receives the query which was intended for it instead of the query which was intended for url-loader.
const fallbackLoaderContext = Object.assign({}, this, {
    query: fallbackOptions,
});

return fallback.call(fallbackLoaderContext, content); //最后执行file-loader
```
完了，所以这俩的区别就是url-loader内部会根据limit的值决定直接把文件转成base64还是直接调用file-loader。
# sass-loader、css-loader、style-loader
## sass-loader
[源码](https://github.com/webpack-contrib/sass-loader/blob/v13.2.2/src/index.js#L22)

```javascript
async function loader(content) {
    const options = this.getOptions(schema); //获取使用sass-loader时传入的options，这里为空
    const callback = this.async(); //这个async函数会返回一个异步执行的函数callback，执行这个callback会把当前loader的结果传递给下一个loader。这里sass-loader不是最终的loader，所以需要这个。
    const implementation = getSassImplementation(this, options.implementation);
    // 获取sass解析器，可以是node-sass、dart-sass或者sass-embedded

    if (!implementation) { // 如果获取不到sass解析器，直接返回，并且给下一个loader callback一个空
        callback();

        return;
    }

    const useSourceMap =
        typeof options.sourceMap === "boolean" ? options.sourceMap : this.sourceMap; // 是否启用sourceMap，这里是true
    const sassOptions = await getSassOptions( 
        this,
        options,
        content,
        implementation,
        useSourceMap
    );
    const shouldUseWebpackImporter =
        typeof options.webpackImporter === "boolean"
            ? options.webpackImporter
            : true;  //表示是否使用webpack解析源码里面的@import，这里的值是true

    if (shouldUseWebpackImporter) {
        const isModernAPI = options.api === "modern";

        if (!isModernAPI) {
            const { includePaths } = sassOptions;

            sassOptions.importer.push(
                getWebpackImporter(this, implementation, includePaths)
            );
        } else {
            sassOptions.importers.push(
                getModernWebpackImporter(this, implementation)
            );
        }
    } 
    // 上面的代码细节不清楚，总的来说，通过options.api判断是否是新版webpack，新旧版本webpack处理@import方法不一样
    const compile = getCompileFn(implementation, options); //通过上面的implementation获取sass编译器

    let result = await compile(sassOptions, options) // 编译sass，这里假设编译没有错误，所以省略了处理错误的代码
    

    let map =
        // Modern API, then legacy API
        result.sourceMap
            ? result.sourceMap
            : result.map
                ? JSON.parse(result.map)
                : null;

    // Modify source paths only for webpack, otherwise we do nothing
    if (map && useSourceMap) {
        map = normalizeSourceMap(map, this.rootContext);
    } // 这里生成的map，最后会通过callback传给下一个loader，这里不关心sourceMap，略

    // Modern API
    if (typeof result.loadedUrls !== "undefined") {
        result.loadedUrls
            .filter((url) => url.protocol === "file:")
            .forEach((includedFile) => {
                const normalizedIncludedFile = url.fileURLToPath(includedFile);

                // Custom `importer` can return only `contents` so includedFile will be relative
                if (path.isAbsolute(normalizedIncludedFile)) {
                    this.addDependency(normalizedIncludedFile);
                }
            });
    }
    // Legacy API
    else if (
        typeof result.stats !== "undefined" &&
        typeof result.stats.includedFiles !== "undefined"
    ) {
        result.stats.includedFiles.forEach((includedFile) => {
            const normalizedIncludedFile = path.normalize(includedFile);

            // Custom `importer` can return only `contents` so includedFile will be relative
            if (path.isAbsolute(normalizedIncludedFile)) {
                this.addDependency(normalizedIncludedFile);
            }
        });
    }
    // 上面这一堆，细节不清楚，总的来说，是处理sass文件里的引入的本地文件，把它们加入webpack的依赖中，以便在它们变化时重新编译sass文件

    callback(null, result.css.toString(), map);
    // 最后把编译好的css传递给下一个loader
}
```
所有，简单说，如果忽略处理@import与source-map的逻辑，sass-loader所做的事，就是先选择合适的sass解析器，然后编译sass文件把结果传给下一个loader。
## css-loader
[源码](https://github.com/webpack-contrib/css-loader/blob/v6.7.3/src/index.js#L33)

这个loader首先会有一堆处理plugin的逻辑，我们这里不关注plugin，直接从[155](https://github.com/webpack-contrib/css-loader/blob/v6.7.3/src/index.js#L155) 行开始看。
 当然，155行这里的plugin非空,因为40行会调用normalizeOptions重新生成options，这里由于我们刚开始的rawOptions是空，这里重新生成的options长这样: 

![2854f00e-4d2a-4e0d-b0b6-85f0d91cafad-图片.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/2854f00e-4d2a-4e0d-b0b6-85f0d91cafad-图片.png)

由于options.url与options.import是true，所以155行的plugin是个长度为2的数组，这里会调用postcss处理这个plugin，主要处理css文件里的@import与url相关。

这里假设没有错误，也没有warning，剩下的那一堆代码细节先不管，直接跳到最后一行，最后一行callback了一个经过拼接的字符串，我们可以把这个字符串log出来:
```javascript
// Imports
import ___CSS_LOADER_API_NO_SOURCEMAP_IMPORT___ from "./loaders/css-loader/runtime/noSourceMaps.js";
import ___CSS_LOADER_API_IMPORT___ from "./loaders/css-loader/runtime/api.js";

var ___CSS_LOADER_EXPORT___ = ___CSS_LOADER_API_IMPORT___(___CSS_LOADER_API_NO_SOURCEMAP_IMPORT___);
// Module
___CSS_LOADER_EXPORT___.push([module.id, ".container {\n  max-width: 960px;\n  margin: 0 auto;\n  padding: 20px;\n  background-color: #fff;\n  border-radius: 4px;\n  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }\n  .container h1 {\n    color: #007bff;\n    font-size: 36px;\n    text-align: center; }\n", ""]);

// Exports
export default ___CSS_LOADER_EXPORT___;
```
从这里可以看到，css-loader把css转换成了可运行的js，转换后的css则通过字符串的形式放在___CSS_LOADER_EXPORT___这个变量上，最后导出___CSS_LOADER_EXPORT___。

这个文件站在使用者的角度上来看没什么意义，css嘛，要么通过link标签引入，要么通过style插入到head里。如果是前者，loader是做不到了，因为loader的作用仅仅是把各种文件转换成可运行的js，这个功能可以用mini-css-extract-plugin，这个插件会在打包过程中拿到css文件的路径，然后在打包结束通过link标签把css插入html，需要配合htmlwebpackplugin使用。如果是后者，可以使用style-loader。
## style-loader
[源码](https://github.com/webpack-contrib/style-loader/blob/v3.3.2/src/index.js#L28)

这个loader的入口是一个pitch函数，我们知道webpack loader是从右往左执行的
```javascript
{
    rules:[
     {
        test: /\.scss$/,
        use:['style-loader','css-loader','sass-loader']
     }
    ]
}
```
假如你的webpack配置长这样，如果没有pitch函数，应该从右往左，即sass-loader css-loader style-loader，如果三个loader都有pitch函数，执行顺序变成这样，style-loader-pitch css-loader-pitch sass-loader-pitch sass-loader css-loader style-loader，如果在这条代码链的执行过程中，有某一个loader的pitch返回了一个值，后面loader的代码就不执行了。

回到真实情况，这里的style-loader-pitch返回了值，所以只会执行style-loader-pitch与style-loader。

这个pitch函数大多数逻辑我们并不需要关注，我仅仅想知道它是如何把css插入dom的（我很懒）。所以只需要关注这个loader最后返回了什么东西，下面是我通过debugger提取出来syle-loader最后生成的东西。
```javascript
import API from "!./loaders/style-loader/runtime/injectStylesIntoStyleTag.js";
import domAPI from "!./loaders/style-loader/runtime/styleDomAPI.js";
import insertFn from "!./loaders/style-loader/runtime/insertBySelector.js";
import setAttributes from "!./loaders/style-loader/runtime/setAttributesWithoutAttributes.js";
import insertStyleElement from "!./loaders/style-loader/runtime/insertStyleElement.js";
import styleTagTransformFn from "!./loaders/style-loader/runtime/styleTagTransform.js";
import content, * as namedExport from "!!./loaders/css-loader/index.js!./loaders/sass-loader/index.js!./style.scss";



var options = {};

options.styleTagTransform = styleTagTransformFn;
options.setAttributes = setAttributes;

options.insert = insertFn.bind(null, "head");

options.domAPI = domAPI;
options.insertStyleElement = insertStyleElement;

var update = API(content, options);


if (module.hot) {
  if (!content.locals || module.hot.invalidate) {
    var isEqualLocals = function isEqualLocals(a, b, isNamedExport) {
      if (!a && b || a && !b) {
        return false;
      }
      var p;
      for (p in a) {
        if (isNamedExport && p === "default") {
          // eslint-disable-next-line no-continue
          continue;
        }
        if (a[p] !== b[p]) {
          return false;
        }
      }
      for (p in b) {
        if (isNamedExport && p === "default") {
          // eslint-disable-next-line no-continue
          continue;
        }
        if (!a[p]) {
          return false;
        }
      }
      return true;
    };
    var isNamedExport = !content.locals;
    var oldLocals = isNamedExport ? namedExport : content.locals;

    module.hot.accept(
      "!!./loaders/css-loader/index.js!./loaders/sass-loader/index.js!./style.scss",
      function () {
        if (!isEqualLocals(oldLocals, isNamedExport ? namedExport : content.locals, isNamedExport)) {
          module.hot.invalidate();

          return;
        }

        oldLocals = isNamedExport ? namedExport : content.locals;

        update(content);
      }
    )
  }

  module.hot.dispose(function () {
    update();
  });
}


export * from "!!./loaders/css-loader/index.js!./loaders/sass-loader/index.js!./style.scss";
export default content && content.locals ? content.locals : undefined;
```
这一段代码会在浏览器里执行，主要是这一句
```javascript
var update = API(content, options);
```
这里的API来自[这里](https://github.com/webpack-contrib/style-loader/blob/v3.3.2/src/runtime/injectStylesIntoStyleTag.js#L84) ,执行API的过程中，会调用[modulesToDom](https://github.com/webpack-contrib/style-loader/blob/v3.3.2/src/runtime/injectStylesIntoStyleTag.js#L16) ,接着是[addElementStyle](https://github.com/webpack-contrib/style-loader/blob/v3.3.2/src/runtime/injectStylesIntoStyleTag.js#L41) ,这个函数的前两句完成了把css通过style标签插入到dom中的任务。
```javascript
function addElementStyle(obj, options) {
    //...
     const api = options.domAPI(options);
     api.update(obj);
    //...
}
```
这里的domAPI来自[这儿](https://github.com/webpack-contrib/style-loader/blob/v3.3.2/src/runtime/styleDomAPI.js#L56) ,首先通过options.insertStyleElement生成styleElement（这里会生成一个空的style标签），然后在update函数内部调用了apply函数，apply函数首先通过一系列条件对传进来的css进行字符串拼接，这里不是重点，关键是最后: 
```javascript
options.styleTagTransform(css, styleElement, options.options);
```
[styleTagTransform](https://github.com/webpack-contrib/style-loader/blob/v3.3.2/src/runtime/styleTagTransform.js)

代码很简单，我们这里只会命中``styleElement.appendChild(document.createTextNode(css));`这一句。

但是有个问题，style-loader的pitch函数返回了值，后面的loader不执行了，那是怎么把sass代码转换成css的，注意看上面style-loader的返回值里面有这么一句: 
```javascript
import content, * as namedExport from "!!./loaders/css-loader/index.js!./loaders/sass-loader/index.js!./style.scss";
```
webpack会解析这个import（带有感叹号的会忽略），然后在import的过程中会执行sass-loader、css-loader。
# babel-loader
# vue-loader
