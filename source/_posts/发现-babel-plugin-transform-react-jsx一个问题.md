---
title: 发现@babel/plugin-transform-react-jsx一个问题
date: 2023-12-12 23:50:06
tags:
---
前几天为fre这个库搭建启动环境时遇到一些问题，首先看我的webpack 配置。
```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: "development",
    entry: './src/index.jsx',
    devtool: 'source-map',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module:{
        rules: [
            {
                test: /\.(?:js|mjs|cjs|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: "defaults" }]
                        ],
                        plugins: [
                            [
                                '@babel/plugin-transform-typescript' //用这个插件来解析ts
                            ],
                            [
                                '@babel/plugin-transform-react-jsx', //用这个插件来解析fre的jsx
                                {
                                    runtime: 'automatic',
                                    importSource: 'fre',
                                },
                            ]
                        ]
                    }
                }
            }
        ],
    },
    resolve: {
        modules: [path.resolve(__dirname, 'src','lib'), 'node_modules'],
        extensions: ['.ts','.js']
    },
    devServer:{
        port: 9000,
        static: {
            directory: path.join(__dirname, './'),
        },
    },
    plugins: [new HtmlWebpackPlugin({
        template: path.join(__dirname,'./index.html')
    })],
};
```
看起来没什么问题，但是运行时却报错了
![d0f0b072-eb1f-42ed-b4db-8d9a2768fe35-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/d0f0b072-eb1f-42ed-b4db-8d9a2768fe35-image.png)

从错误的堆栈信息来看，是babel-parser报的错。很明显，这个错误跟正则表达式没什么关系，但是为什么babel-parser会把这段代码看成正则表达式呢，babel-parser的作用是把javascript解析成抽象语法树，常见的js语法肯定都支持，但是jsx不是标准的js语法，看babel-parser的文档，它支持一个plugins选项，比如你可以用以下代码来开启解析jsx与flow。
```javascript
require("@babel/parser").parse("code", {
  // parse in strict mode and allow module declarations
  sourceType: "module",

  plugins: [
    // enable jsx and flow syntax
    "jsx",
    "flow",
  ],
});
```
但是我们毕竟不是直接用的babel-parser，肯定是babel-loader到babel-parser的调用过程中哪一步出错了。带着这个问题，我们来大概扒一扒babel-loader的代码。

[transform.js#L10](https://github.com/babel/babel-loader/blob/v9.1.3/src/transform.js#L10) 这里的transform来自babel-core，最终来自这里的[run](https://github.com/babel/babel/blob/v7.23.6/packages/babel-core/src/transformation/index.ts#L34),这个方法有几部分非常关键。
```javascript
// 通过babel-parser把code转换成ast
const file = yield* normalizeFile(
    config.passes,
    normalizeOptions(config),
    code,
    ast,
  );
```
```javascript
// 通过babel-traverse结合各个plugin对ast进行增删改
 yield* transformFile(file, config.passes);
```
```javascript
//把更改后的ast通过babel-generator还原成code
try {
    if (opts.code !== false) {
        ({ outputCode, outputMap } = generateCode(config.passes, file));
    }
} catch (e) {
    e.message = `${opts.filename ?? "unknown file"}: ${e.message}`;
    if (!e.code) {
        e.code = "BABEL_GENERATE_ERROR";
    }
    throw e;
}
```
我们的问题是babel-parser不识别jsx语法，也就是normalizeFile方法部分。

[normalize-file.ts#L50](https://github.com/babel/babel/blob/v7.23.6/packages/babel-core/src/transformation/normalize-file.ts#L50) 这个parser是通过babel-core/src/parser/index.ts导出的，最终调用了babel-parser导出的parse方法。
```javascript
parse(code, parserOpts);
```
是不是和babel-parser文档上的例子很像，所以只要找到这个parserOpts从哪里来的以及包含哪些内容就能解决这个问题。
回到[run方法](https://github.com/babel/babel/blob/v7.23.6/packages/babel-core/src/transformation/index.ts#L39)，第二个参数normalizeOptions(config)就是parserOpts的来源。

[normalize-opts.ts#L62](https://github.com/babel/babel/blob/v7.23.6/packages/babel-core/src/transformation/normalize-opts.ts#L62)
这里依次判断每个插件上是否有manipulateOptions方法，如果有调用并传入parserOpts。

我们webpack配置中的@babel/plugin-transform-typescript与@babel/plugin-transform-react-jsx都有这个方法，先看@babel/plugin-transform-typescript，这个插件继承自@babel/plugin-syntax-typescript，里面有一句
```javascript
// https://github.com/babel/babel/blob/v7.23.6/packages/babel-plugin-syntax-typescript/src/index.ts#L59
manipulateOptions(opts, parserOpts)
{
    if (!process.env.BABEL_8_BREAKING) {
        const {plugins} = parserOpts;
        // If the Flow syntax plugin already ran, remove it since Typescript
        // takes priority.
        removePlugin(plugins, "flow");

        // If the JSX syntax plugin already ran, remove it because JSX handling
        // in TS depends on the extensions, and is purely dependent on 'isTSX'.
        removePlugin(plugins, "jsx");

        // These are now enabled by default in @babel/parser, but we push
        // them for compat with older versions.
        plugins.push("objectRestSpread", "classProperties");

        if (isTSX) {
            plugins.push("jsx");
        } // 这里，如果传递给这个插件的参数里有isTSX，将开启babel-parser的jsx plugin
    }
    parserOpts.plugins.push([
        "typescript",
        {disallowAmbiguousJSXLike, dts},
    ]);
}
```
再看看@babel/plugin-transform-react-jsx，继承自@babel/plugin-syntax-jsx
```javascript
//https://github.com/babel/babel/blob/v7.23.6/packages/babel-plugin-syntax-jsx/src/index.ts
manipulateOptions(opts, parserOpts) {
    if (!process.env.BABEL_8_BREAKING) {
        // If the Typescript plugin already ran, it will have decided whether
        // or not this is a TSX file.
        if (
            parserOpts.plugins.some(
                p => (Array.isArray(p) ? p[0] : p) === "typescript",
            ) // 这里错了，不能单纯的说我用了@babel/plugin-transform-typescript，就return掉，应该判断是否开启了jsx plugin
        ) {
            return;
        }
    }

    parserOpts.plugins.push("jsx");
}
```
所以，应该改成这样
```javascript
if (parserOpts.plugins.some(p => (Array.isArray(p) ? p[0] : p) === "typescript") && parserOpts.plugins.includes('jsx')) {
  return;
}
```
这样就好了。



