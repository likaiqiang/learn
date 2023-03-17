---
title: 学习ahooks之useLongPress
date: 2023-03-17 19:23:09
tags:
---
# 缘由
可能是小程序api用多了，前几天写网页有个需求是监听长按，竟然有点生疏，幸好ahooks实现了useLongPress这个hook。
# 代码
[原版代码](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/useLongPress/index.ts)

```javascript
const touchSupported =
  isBrowser &&
  // @ts-ignore
  ('ontouchstart' in window || (window.DocumentTouch && document instanceof DocumentTouch));

function useLongPress(
  onLongPress: (event: EventType) => void,
  target: BasicTarget,
  { delay = 300, moveThreshold, onClick, onLongPressEnd }: Options = {},
) {
  const onLongPressRef = useLatest(onLongPress);
  const onClickRef = useLatest(onClick);
  const onLongPressEndRef = useLatest(onLongPressEnd);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isTriggeredRef = useRef(false);
  const pervPositionRef = useRef({ x: 0, y: 0 });
  const hasMoveThreshold = !!(
    (moveThreshold?.x && moveThreshold.x > 0) ||
    (moveThreshold?.y && moveThreshold.y > 0)
  );

  useEffectWithTarget(
    () => {
      const targetElement = getTargetElement(target);
      if (!targetElement?.addEventListener) {
        return;
      }

      const overThreshold = (event: EventType) => {
        const { clientX, clientY } = getClientPosition(event);
        const offsetX = Math.abs(clientX - pervPositionRef.current.x);
        const offsetY = Math.abs(clientY - pervPositionRef.current.y);

        return !!(
          (moveThreshold?.x && offsetX > moveThreshold.x) ||
          (moveThreshold?.y && offsetY > moveThreshold.y)
        );
      };

      function getClientPosition(event: EventType) {
        if (event instanceof TouchEvent) {
          return {
            clientX: event.touches[0].clientX,
            clientY: event.touches[0].clientY,
          };
        }

        if (event instanceof MouseEvent) {
          return {
            clientX: event.clientX,
            clientY: event.clientY,
          };
        }

        console.warn('Unsupported event type');

        return { clientX: 0, clientY: 0 };
      }

      const onStart = (event: EventType) => {
        if (hasMoveThreshold) {
          const { clientX, clientY } = getClientPosition(event);
          pervPositionRef.current.x = clientX;
          pervPositionRef.current.y = clientY;
        }
        timerRef.current = setTimeout(() => {
          onLongPressRef.current(event);
          isTriggeredRef.current = true;
        }, delay);
      };

      const onMove = (event: TouchEvent) => {
        if (timerRef.current && overThreshold(event)) {
          clearInterval(timerRef.current);
          timerRef.current = undefined;
        }
      };

      const onEnd = (event: EventType, shouldTriggerClick: boolean = false) => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        if (isTriggeredRef.current) {
          onLongPressEndRef.current?.(event);
        }
        if (shouldTriggerClick && !isTriggeredRef.current && onClickRef.current) {
          onClickRef.current(event);
        }
        isTriggeredRef.current = false;
      };

      const onEndWithClick = (event: EventType) => onEnd(event, true);

      if (!touchSupported) {
        targetElement.addEventListener('mousedown', onStart);
        targetElement.addEventListener('mouseup', onEndWithClick);
        targetElement.addEventListener('mouseleave', onEnd);
        if (hasMoveThreshold) targetElement.addEventListener('mousemove', onMove);
      } else {
        targetElement.addEventListener('touchstart', onStart);
        targetElement.addEventListener('touchend', onEndWithClick);
        if (hasMoveThreshold) targetElement.addEventListener('touchmove', onMove);
      }
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          isTriggeredRef.current = false;
        }
        if (!touchSupported) {
          targetElement.removeEventListener('mousedown', onStart);
          targetElement.removeEventListener('mouseup', onEndWithClick);
          targetElement.removeEventListener('mouseleave', onEnd);
          if (hasMoveThreshold) targetElement.removeEventListener('mousemove', onMove);
        } else {
          targetElement.removeEventListener('touchstart', onStart);
          targetElement.removeEventListener('touchend', onEndWithClick);
          if (hasMoveThreshold) targetElement.removeEventListener('touchmove', onMove);
        }
      };
    },
    [],
    target,
  );
}
```
先忽略种种细节，useLongPress这个函数接收三个参数：
1. onLongPress，顾名思义，触发长按事件的回调函数。
2. target：可以是dom元素，也可以是存储dom元素的ref。
3. 第三个参数是个对象，有四个子参数：delay(长按多长时间以后触发长按事件，也就是触发长按事件的时间)、moveThreshold（在长按的过程中鼠标或者手指如果有移动，并且这个值存在，会根据这个参数的值决定是否响应长按事件）、onClick(如果有这个值，并且鼠标或者手指按压结束，并且按压时间小于delay，会调用onClick函数)、onLongPressEnd(如果按压结束已经触发过长按事件，在真正结束的时候如果有这个值会调用onLongPressEnd函数)。

代码开头那个useEffectWithTarget先认为就是useEffect，先忽略useEffectWithTarget大多数代码，直接看这几句：

```javascript
if (!touchSupported) {
    targetElement.addEventListener('mousedown', onStart);
    targetElement.addEventListener('mouseup', onEndWithClick);
    targetElement.addEventListener('mouseleave', onEnd);
    if (hasMoveThreshold) targetElement.addEventListener('mousemove', onMove);
} else {
    targetElement.addEventListener('touchstart', onStart);
    targetElement.addEventListener('touchend', onEndWithClick);
    if (hasMoveThreshold) targetElement.addEventListener('touchmove', onMove);
}
return () => {
    if (timerRef.current) {
        clearTimeout(timerRef.current);
        isTriggeredRef.current = false;
    }
    if (!touchSupported) {
        targetElement.removeEventListener('mousedown', onStart);
        targetElement.removeEventListener('mouseup', onEndWithClick);
        targetElement.removeEventListener('mouseleave', onEnd);
        if (hasMoveThreshold) targetElement.removeEventListener('mousemove', onMove);
    } else {
        targetElement.removeEventListener('touchstart', onStart);
        targetElement.removeEventListener('touchend', onEndWithClick);
        if (hasMoveThreshold) targetElement.removeEventListener('touchmove', onMove);
    }
};
```
根据是否支持触摸事件，分别监听鼠标或者touch事件，响应的事件很有规律，只不过鼠标事件多了个mouseleave，这里我觉得touch事件也应该加个对应的，比如touchcancel。

onStart
```javascript
const onStart = (event: EventType) => {
    if (hasMoveThreshold) {
        const {clientX, clientY} = getClientPosition(event);
        pervPositionRef.current.x = clientX;
        pervPositionRef.current.y = clientY;
    } // 假设没有moveThreshold，这一句先忽略
    timerRef.current = setTimeout(() => {
        onLongPressRef.current(event);
        isTriggeredRef.current = true;
    }, delay); //delay秒后执行onLongPressRef.current，isTriggeredRef.current表示是否执行过onLongPress
};
```
onEndWithClick
```javascript
const onEndWithClick = (event: EventType) => onEnd(event, true);
const onEnd = (event: EventType, shouldTriggerClick: boolean = false) => {
    if (timerRef.current) {
        clearTimeout(timerRef.current); //鼠标抬起或者触摸结束时，如果onLongPress还没有调用，清除定时器
    }
    if (isTriggeredRef.current) { //如果onLongPress已经被调用过了，调用onLongPressEnd（如果有）
        onLongPressEndRef.current?.(event);
    }
    if (shouldTriggerClick && !isTriggeredRef.current && onClickRef.current) { 
        onClickRef.current(event);
    } // 这里的shouldTriggerClick为true，如果onLongPress还没有被触发并且有onClick，调用onClick
    isTriggeredRef.current = false;
};
```
onStart与onEndWithClick其实就是onLongPress函数的核心。有时候按压的时候会移动，这时候是否触发longpress事件，这种情况就需要传moveThreshold。

这个值是个对象{x:0,y:0}，如果按压的过程中有移动，移动的距离(x/y)大于moveThreshold.x或者moveThreshold.y，就会取消响应longPress。

```javascript
const onMove = (event: TouchEvent) => {
    if (timerRef.current && overThreshold(event)) { //移动的时候还没有响应longPress，并且移动的距离超了，就会取消定时器
        clearInterval(timerRef.current);
        timerRef.current = undefined;
    }
};
```
以上就是useLongPress的主要内容。
## useEffectWithTarget
这里顺便提一下这个hook，代码在[这里](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/utils/createEffectWithTarget.ts)，看起来功能和useEffect差不多，只不过多了对前后dom元素的对比，[代码](https://github.com/alibaba/hooks/blob/master/packages/hooks/src/utils/createEffectWithTarget.ts#L42)，参数也由useEffect的两个变成了三个。我觉得这个hook的意义更多的在于代码的可读性，由于第三个参数的存在，可以明确表示这个hook是与哪个dom元素相关联。

