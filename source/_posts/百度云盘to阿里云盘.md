---
title: 百度云盘to阿里云盘
date: 2022-08-07 17:35:18
tags:
---
# 前言
2T百度云终究还是满了，常年的日积月累，删又不知道该该删啥。阿里云盘最近兴起，如果能把部分文件移到阿里云盘里就好了，由于众所周知的原因，百度与阿里的数据是不可能相通的，也不可能会出现官方的xxx迁移工具之类的。所以，这又是一个八仙过海各显神通的活，大家的思路普遍都是先把百度云盘里的资料下载下来，然后再上传到阿里云，这让我想起来宋丹丹的一句名言，把大象装冰箱分几步...

思路是这样没错，但是大神的做法跟普通人就是不一样，可以参考[这个](https://www.zhihu.com/question/451854774) 帖子。本文介绍的是用webdav的那个。

![5e45b33c-8480-4dba-8cf1-8508e26acfa3-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/5e45b33c-8480-4dba-8cf1-8508e26acfa3-image.png)

# 正文
本文只适用于windows操作系统。

整体的流程就是帖子里说的1、2、3、4、5，不过作为一个务实的搬运工，实际操作过程中有跟帖子不一样的地方。

## 第一处：

![d98d7fa0-8ced-43b5-9fd8-e09b8bd0e6ca-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/d98d7fa0-8ced-43b5-9fd8-e09b8bd0e6ca-image.png)

作者一笔带过...。正常操作是这样的，找到你电脑的“启动或关闭windows功能”，然后找到Hyper-V选项，勾上。

![2ac146d3-b31d-45d0-a7d6-1afa9d862691-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/2ac146d3-b31d-45d0-a7d6-1afa9d862691-image.png)

有些人可能找不到Hyper-V选项（比如我），这种情况需要单独安装Hyper-V，参考[这篇](https://blog.csdn.net/weixin_37695006/article/details/91589895) .

在实际操作过程中发现Hyper-V.cmd下载资源很慢，所以最好加上这一句
```
netsh winhttp set proxy http://127.0.0.1:7890
```
如果一切顺利，你的“启动或关闭windows功能“里面就能找到Hyper-V了。

## 第二处：

![c83d80c9-7029-442a-9909-7ae7104cfeaf-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/c83d80c9-7029-442a-9909-7ae7104cfeaf-image.png)

又是一笔带过。实际情况是下载安装都没问题，但是运行不起来，类似于这张图：

![ee5cccf5-a51c-4c0e-8d7d-cbf87c801fba-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/ee5cccf5-a51c-4c0e-8d7d-cbf87c801fba-image.png)

这个问题搞得我都快放弃了，后来搞了个低版本的docker@4.5.1，装上后，还是一样的症状，不过弹了另一个提示，大概内容是我机器上的wsl版本太低，打开给定的链接更新wsl，然后再restart。

[链接](https://docs.microsoft.com/zh-cn/windows/wsl/install-manual#step-4---download-the-linux-kernel-update-package)

按照链接里面的步骤搞完后，docker果然跑起来了。

## 第三处

![07339a99-030b-4140-b899-366904904ea7-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/07339a99-030b-4140-b899-366904904ea7-image.png)

这个也很坑，老说我没权限什么的，为此，我还专门注册了个docker账号，最后的结果是zx5253/webdav-aliyundriver的作者删库了。好吧，那就找替代品，最后用的是[这个](https://github.com/messense/aliyundrive-webdav)

![fad8809b-61e5-42bf-9f79-7d553a827bd1-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/fad8809b-61e5-42bf-9f79-7d553a827bd1-image.png)

## 第四处

这一步需要注意的是那个截图

![72cef2ba-086b-4c61-b62e-0f532d30471d-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/72cef2ba-086b-4c61-b62e-0f532d30471d-image.png)

红色框图里面的小盾牌表示是否启用https，不要勾选。

## 第五处

![38dd9679-108d-4ff1-a924-59787038a263-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/38dd9679-108d-4ff1-a924-59787038a263-image.png)

简简单单三个字：连接后。问题是我根本就连接不上。也是弹了个错误提示：“由于目标计算机积极拒绝，无法连接”。

这一步也搞得我快要放弃了，网上找了各种办法都没用，最后还是重启大法好，不过重启的是docker的container，也就是这一步在重启的过程中出问题了，解决了这一问题，上一步奇迹般的连接上了。

[参考](https://stackoverflow.com/questions/65272764/ports-are-not-available-listen-tcp-0-0-0-0-50070-bind-an-attempt-was-made-to) 

```powershell
net stop winnat
docker start container_name
net start winnat
```

经过后来的实践，我发现先启动raidriver，然后再启动docker，是直接可以连上的。第一次按教程上的步骤，顺序反而是反的。






