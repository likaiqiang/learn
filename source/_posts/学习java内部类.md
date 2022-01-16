---
title: 学习java内部类
date: 2022-01-09 22:04:25
tags:
---

# 前言
作为一个只擅长javascript的伪程序员，学习java还是挺费劲的，不过没关系，再庞然大物，也能分而治之。

google搜内部类，好多文章都说java有四种内部类。成员内部类，静态内部类、局部内部类、匿名内部类。记性好的可以直接记住，彷佛回到了读书时代。

# 四大内部类
## 成员内部类

java是一门强大的面向对象编程语言。在java中，一个类的成员变量，可以是字符串、数字这样的基础数据类型，也可以是数组、Map这样的复杂数据类型，甚至可以是别的类的实例，那为什么不能是一个类呢？

所以把一个类放在java的成员变量位置上，这个类就是成员内部类，放到静态变量位置上，这个类就是静态内部类。

所以很容易写出这样的代码。

```java
public class xxxOuterClass {
    private String a = "1212";
    class Inner{
        void log(){
            System.out.println(a); //标记1
        }
    }
}
class TY{
    public static void main(String[] args) {
        xxxOuterClass n = new xxxOuterClass();
        xxxOuterClass.Inner m = n.new Inner(); //标记2
        m.log();
    }
}
```
java这门语言单从长相上还是挺像typescript的。但是typescript是没有内部类概念的。上面那段代码有几处奇怪的地方，首先是标记1那个孤零零的a变量，实际上java会先找Inner上有没有叫a的成员变量，如果没有，再去找xxxOuterClass。

再来看标记2，内部类是怎么被实例化的。成员内部类依附于它所对应的外部类，所以需要先实例化一个外部类。这不奇怪，想也能想通，奇怪的是new 操作符就然可以那样使用。按照正常的思维，难道不是xxxOuterClass.Inner m = new n.Inner()吗？

既然一个类可以作为另一个类的成员，那么Inner是否能被访问修饰符修饰呢？实际上分别用public、protected、private修饰Inner，并不报错，只不过用private修饰Inner，在TY中不能实例化Inner。那继承呢？

```java
class TY2 extends xxxOuterClass{
    public static void main(String[] args) {
        TY2 ty = new TY2();
        TY2.Inner inner = ty.new Inner();
        inner.log();
    }
}
```
看来也是可以的。
## 静态内部类
```java
public class xxxOuterClass {
    private String a = "1212";
    static class Inner{
        void log(){
            System.out.println("cwwd");
        }
    }
}

class TY{
    public static void main(String[] args) {
        xxxOuterClass.Inner m = new xxxOuterClass.Inner();
        m.log();
    }
}
```
静态内部类和静态变量差不多。
## 局部内部类
所谓局部内部类就是说一个类可以写到某个方法内部。 你用学js的思维去学java就感觉特别烦，什么花花草草都要起个名字。这不是理所当然的吗？
## 匿名内部类
匿名内部类不是说某个类没有名字，而是说你可以直接继承/实现某个类，然后直接new，不用写那么多繁文缛节。通常配合接口与抽象类来使用。看代码。
```java
abstract class  xxxFoo{
    abstract void log();
}

interface xxxFoo2{
    void log2();
}

class TY{
    public static void main(String[] args) {
        xxxFoo foo = new xxxFoo() {
            @Override
            void log() {
                System.out.println("xxxFoo log");
            }
        };
        xxxFoo2 foo2 = new xxxFoo2() {
            @Override
            public void log2() {
                System.out.println("xxxFoo2 log");
            }
        };
    }
}
```
众所周知，在java中，抽象类只能被继承，不能直接实例化，接口只能被实现，不能直接实例化。现在有了特例，除非被用于匿名内部类。

上面的代码按正常思路应该这样写
```java
abstract class  xxxFoo{
    abstract void log();
}

interface xxxFoo2{
    void log2();
}

class TY{
    public static void main(String[] args) {
        class xxxFoo3 extends xxxFoo{
            @Override
            void log() {
                System.out.println("log1");
            }
        }
        xxxFoo3 foo = new xxxFoo3();
        class xxxFoo4 implements xxxFoo2{

            @Override
            public void log2() {
                System.out.println("log2");
            }
        }
    }
}
```
原来如此，在这个例子中，所谓匿名，确实省了两个名字。但是转念一想，这不是概念冲突嘛，明明抽象类和接口都不能直接实例化，为啥用于匿名内部类就可以。其实匿名内部类是一种语法糖，java编译器会帮忙补齐缺失的语法。稍微改一下上面的例子。
```java
abstract class  xxxFoo{
    abstract void log();
}

interface xxxFoo2{
    void log2();
}

class TY{
    public static void main(String[] args) {
        xxxFoo foo = new xxxFoo() {
            @Override
            void log() {
                System.out.println("log1");
                System.out.println(this.getClass()); // class TY$1
            }
        };
        xxxFoo2 foo2 = new xxxFoo2() {
            @Override
            public void log2() {
                System.out.println("log2");
                System.out.println(this.getClass()); // class TY$2
            }
        };
        foo.log();
        foo2.log2();
    }
}
```
看到没有，还是会有类，只不过不用开发者操心。
# 直接继承内部类
我们可以先实例化出外部类，然后再实例化出内部类。我们也可以直接继承一个内部类。
```java
class xxxxOuter{
    class xxxInner{
        void log(){
            System.out.println("log");
        }
    }
}

class xxxInner2 extends xxxxOuter.xxxInner{
    xxxInner2(xxxxOuter wi){
        wi.super(); //标记1
    }

    public static void main(String[] args) {
        xxxInner2 m = new xxxInner2(new xxxxOuter());
        m.log();
    }
}
```
由于成员内部类依赖与外部类，所以xxxInner2的构造函数必须接收一个xxxxOuter的实例，然后调用其super方法。

但是奇怪的是，在我的idea上wi.super标红了，idea认为wi上没有super这个方法？但却可以运行！为啥这里需要调用wi上的super方法，super不是表示父类/父类构造器嘛，xxxxOuter并没有父类，为啥这里不写成wi.constructor()之类的更语义化的api？


