# Live2D Cubism SDK for Web — 使用文档

基于 Live2D Cubism SDK for Web 5-r.5 (TypeScript)，支持 `<script>` 标签引入、HTML 属性配置、全局 API 控制。

---

## 快速开始

```html
<div id="live2d-container"
     data-model-path="./Resources/"
     data-cubism-model="Haru"
     data-show-background="true">
</div>

<script src="./Core/live2dcubismcore.js"></script>
<script type="module" src="./assets/index-xxx.js"></script>

<script>
  Live2DModel.onReady(() => console.log('模型就绪'));
</script>
```

---

## 一、HTML 属性配置

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `data-cubism-model` | `string` | `"Haru"` | 模型名称（与文件夹名一致） |
| `data-model-path` | `string` | `./Resources/` | 资源根目录（支持跨域 URL） |
| `data-show-background` | `"true"` / `"false"` | `"true"` | 是否显示背景图 |
| `data-background-image` | `string` | 空 | 自定义背景图（http/https 或相对路径） |
| `data-shader-path` | `string` | 空 | 自定义着色器路径（跨域 CDN 时使用） |
| `data-container` | `string` | 空 | canvas 挂载目标容器选择器（默认使用配置元素自身） |

### 跨域 CDN 部署

```html
<script>window.LIVE2D_BASE_URL = 'https://cdn.example.com/live2d/';</script>
<script type="module" src="https://cdn.example.com/live2d/assets/index-xxx.js"></script>

<div id="live2d-container"
     data-model-path="./Resources/"
     data-cubism-model="Haru">
</div>
```

---

## 二、全局 API — `window.Live2DModel`

### 2.1 模型控制

| 方法 | 说明 | 需刷新 |
|---|---|---|
| `changeModel(name)` | 运行时切换模型 | 否 |
| `showBackground(show)` | 运行时开关背景 | 否 |
| `setConfig(key, value)` | 修改 HTML 属性配置 | 需 `refresh()` |
| `refresh()` | 刷新页面应用配置 | — |

---

### 2.2 模型缩放（等比例，仅缩小）

缩放范围 30% ~ 100%，等比例缩放，不影响触摸坐标精度。

| 方法 | 说明 |
|---|---|
| `setScale(scale)` | 直接设置缩放值（0.3 ~ 1.0） |
| `getScale()` | 获取当前缩放值 |
| `zoomByWheel(delta)` | 滚轮缩放（传入 `wheel` 事件的 `deltaY`） |
| `beginResizeDrag(x, y, cw, ch)` | 开始拖拽缩放 |
| `updateResizeDrag(x, y, cw, ch)` | 拖拽缩放更新 |
| `endResizeDrag()` | 结束拖拽缩放 |

```js
// 滑块设置
Live2DModel.setScale(0.6);

// 鼠标滚轮缩放
container.addEventListener('wheel', (e) => {
  e.preventDefault();
  Live2DModel.zoomByWheel(e.deltaY);
}, { passive: false });

// 拖拽右下角手柄缩放
grip.addEventListener('pointerdown', (e) => {
  const rect = container.getBoundingClientRect();
  Live2DModel.beginResizeDrag(e.clientX, e.clientY, rect.width, rect.height);
});
grip.addEventListener('pointermove', (e) => {
  const rect = container.getBoundingClientRect();
  Live2DModel.updateResizeDrag(e.clientX, e.clientY, rect.width, rect.height);
});
grip.addEventListener('pointerup', () => Live2DModel.endResizeDrag());
```

---

### 2.3 模型拖拽移动

右键拖拽 或 Ctrl+左键拖拽 可将模型移动到页面任意位置。

| 方法 | 说明 |
|---|---|
| `beginModelPan(x, y)` | 开始拖拽移动（传入页面坐标） |
| `updateModelPan(dx, dy)` | 更新位移（像素增量） |
| `endModelPan()` | 结束拖拽 |
| `resetModelPan()` | 重置到原点 |

```js
let panStartX = 0, panStartY = 0;
let isPanning = false;

container.addEventListener('pointerdown', (e) => {
  if (e.button === 2 || e.ctrlKey || e.metaKey) {
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    Live2DModel.beginModelPan(e.clientX, e.clientY);
  }
});
container.addEventListener('pointermove', (e) => {
  if (!isPanning) return;
  const dx = e.clientX - panStartX;
  const dy = e.clientY - panStartY;
  panStartX = e.clientX;
  panStartY = e.clientY;
  Live2DModel.updateModelPan(dx, dy);
});
container.addEventListener('pointerup', () => {
  if (isPanning) { isPanning = false; Live2DModel.endModelPan(); }
});
```

---

### 2.4 生命周期钩子

#### `Live2DModel.onReady(callback)`
模型完成加载（纹理、着色器、动作全部就绪）时触发。

```js
Live2DModel.onReady(() => {
  console.log('模型已就绪，可以开始交互');
});
```

---

### 2.5 对口型 & 说话

Live2D SDK 解析 WAV 文件的 PCM 数据，提取 RMS（音量包络）驱动口型参数，无需真实播放音频。

#### `Live2DModel.startTalk(audioUrl, text?)`
播放 WAV 音频并对口型，触发气泡钩子。

```js
// 有音频文件 → 口型跟随音量变化
Live2DModel.startTalk('./sounds/hello.wav', '你好！');

// 无音频 → 用表情/motion 模拟说话（自动检测模型行为）
Live2DModel.startTalk('', '嗯…今天天气不错~');
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `audioUrl` | `string` | WAV 音频 URL（空字符串 = 无音频，用行为模拟） |
| `text` | `string` | 气泡中显示的文本 |

#### `Live2DModel.stopTalk()`
立即停止当前说话。

---

### 2.6 自动说话

#### `Live2DModel.startAutoTalk(minMs?, maxMs?)`
随机间隔自动说话。默认 8~20 秒。

```js
Live2DModel.startAutoTalk(5000, 12000); // 5~12 秒
```

#### `Live2DModel.stopAutoTalk()`
停止自动说话。

#### `Live2DModel.setTalkTexts(texts)`
设置自动说话随机选取的文本库。

```js
Live2DModel.setTalkTexts(['你好！', '今天天气真好~', '有什么想聊的？']);
```

---

### 2.7 说话行为自定义

不同模型的行为定义（motion 组名、表情名）可能不一致。系统提供三种配置方式：

#### 方式一：简单指定 motion 组名

```js
// 先查看模型有哪些 motion 组
Live2DModel.onReady(() => {
  const info = Live2DModel.getModelInfo();
  console.log(info.motionGroups); // → ['Idle', 'Talk', 'TapBody']
});

// 指定用 'Talk' 组作为说话行为
Live2DModel.setTalkMotionGroup('Talk');
```

#### 方式二：完全自定义行为

```js
Live2DModel.setTalkAction((model, text, duration) => {
  // 自由组合模型支持的任何行为
  model.setRandomExpression();           // 随机表情
  model.startRandomMotion('Speak', 3);   // 播放 motion（优先级 3=强制）
});
```

#### 方式三：自动检测（默认）

不调用任何配置方法时，系统自动检测：

| 优先级 | 条件 | 行为 |
|---|---|---|
| 1 | 模型有表情定义 | 随机切换表情 |
| 2 | 模型有 motion 组（非 Idle） | 播放随机 motion |
| 3 | 都没有 | 仅显示气泡 |

---

### 2.8 模型行为信息

#### `Live2DModel.getModelInfo()`
获取当前模型支持的 motion 组、表情名、是否支持对口型。

```js
const info = Live2DModel.getModelInfo();
// {
//   motionGroups: ['Idle', 'TapBody'],
//   expressionNames: ['F01', 'F02', 'F03', 'F04'],
//   hasLipSync: true
// }
```

#### `Live2DModel.setTalkMotionGroup(groupName)`
简单指定说话时播放哪个 motion 组。传空字符串恢复自动检测。

#### `Live2DModel.setTalkAction(action | null)`
完全自定义说话行为。回调参数：
- `model` — `LAppModel` 实例（可调用 `startRandomMotion` / `setRandomExpression` 等）
- `text` — 当前说话文本
- `durationSec` — 预计持续时长（秒）

传 `null` 恢复自动检测模式。

---

### 2.9 气泡钩子

#### `Live2DModel.onTalkStart(callback)`
说话开始 — 用于显示气泡。

```js
Live2DModel.onTalkStart((text, durationSec) => {
  bubble.textContent = text;
  bubble.style.display = 'block';
  // durationSec 可用于设置气泡自动消失时间
});
```

#### `Live2DModel.onTalkEnd(callback)`
说话结束 — 用于隐藏气泡。

```js
Live2DModel.onTalkEnd(() => {
  bubble.style.display = 'none';
});
```

---

### 2.10 自定义触控区域

模型 `.cdi3.json` 中定义的可点击区域（如 `Head`、`Body`），可以通过钩子自定义点击行为。

#### `Live2DModel.onHitArea(areaName, callback)`

注册指定区域的点击回调。回调参数：`(areaName, x, y)`。

```js
Live2DModel.onReady(() => {
  Live2DModel.onHitArea('Head', (areaName, x, y) => {
    console.log(`点击了${areaName}`);
    Live2DModel.startTalk('', '别摸头！');
  });

  Live2DModel.onHitArea('Body', (areaName, x, y) => {
    Live2DModel.startTalk('', '哎呀~');
  });
});
```

#### `Live2DModel.offHitArea(areaName, callback)`

移除指定区域的点击回调（需传入注册时的同一个函数引用）。

```js
function onHeadTap(name, x, y) { /* ... */ }
Live2DModel.onHitArea('Head', onHeadTap);
// 需要移除时：
Live2DModel.offHitArea('Head', onHeadTap);
```

#### `Live2DModel.onAnyTap(callback)`

注册任意点击回调（不区分区域，每次点击都触发）。回调参数：`(x, y)`。

```js
Live2DModel.onAnyTap((x, y) => {
  console.log('模型被点击', x, y);
});
```

> **注意**：自定义区域回调优先于默认行为。注册回调后该区域的默认动作不会触发。
> 可通过 `offHitArea` 移除后恢复默认行为。

---

### 2.11 通用动作注册表

将任意动作注册为具名函数，解耦行为定义和触发逻辑（替代之前仅限 talk 的自定义行为）。

#### `Live2DModel.registerAction(name, fn)`

注册一个具名动作。

```js
Live2DModel.registerAction('greet', (text) => {
  Live2DModel.startTalk('', text);
});

Live2DModel.registerAction('switchModel', (modelName) => {
  Live2DModel.changeModel(modelName);
});
```

#### `Live2DModel.triggerAction(name, ...args)`

触发已注册的动作，可传任意参数。

```js
// 触发单个动作
Live2DModel.triggerAction('greet', '你好呀！');

// 在触控区域回调中触发
Live2DModel.onHitArea('Head', () => {
  Live2DModel.triggerAction('greet', '别碰头！');
});
```

#### `Live2DModel.unregisterAction(name)`

移除已注册的动作。

```js
Live2DModel.unregisterAction('greet');
```

#### `Live2DModel.listActions()`

获取所有已注册的动作名称。

```js
console.log(Live2DModel.listActions()); // → ['greet', 'switchModel', 'dance']
```

> **注意**：`triggerAction` 会 `try/catch` 包裹执行，出错会打印错误但不中断调用方。

---

### 2.12 容器控制

Canvas 默认挂载到配置元素（`#live2d-container`）自身，也可以通过 `data-container` 属性指定其他容器。

#### `data-container`（HTML 属性）

指定 canvas 挂载到哪个 DOM 元素（CSS 选择器）。

```html
<style>
  #my-model-box { width: 400px; height: 500px; }
</style>

<div id="my-model-box"></div>

<div id="live2d-container"
     data-model-path="./Resources/"
     data-cubism-model="Haru"
     data-container="#my-model-box">
</div>
```

> Canvas 默认背景为透明，可直接透过 canvas 看到容器自身样式或页面背景。

#### `Live2DModel.getContainer()`

获取当前 canvas 所在的容器元素。

```js
const el = Live2DModel.getContainer();
console.log(el); // → <div id="my-model-box">...
```

#### `Live2DModel.setContainer(el)`

程序化设置容器（需 `refresh()` 生效）。

```js
// 传入元素
Live2DModel.setContainer(document.getElementById('my-wrapper'));

// 传入选择器
Live2DModel.setContainer('#sidebar-model');

// 刷新生效
Live2DModel.refresh();
```

---

## 三、完整示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live2D Demo</title>
  <style>
    html, body { margin: 0; height: 100vh; overflow: hidden; background: #0f172a; }
    #my-bubble {
      position: absolute; top: 15%; left: 55%; max-width: 260px;
      padding: 10px 16px; border-radius: 14px;
      background: rgba(255,255,255,0.9); color: #1e293b; font-size: 14px;
      opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 20;
    }
    #my-bubble.show { opacity: 1; }
  </style>
</head>
<body>

<div id="live2d-container"
     data-model-path="./Resources/"
     data-cubism-model="Haru"
     data-show-background="true">
</div>
<div id="my-bubble"></div>

<script src="./Core/live2dcubismcore.js"></script>
<script type="module" src="./assets/index-xxx.js"></script>

<script>
  const bubble = document.getElementById('my-bubble');

  Live2DModel.onTalkStart((text) => {
    bubble.textContent = text;
    bubble.classList.add('show');
  });
  Live2DModel.onTalkEnd(() => {
    bubble.classList.remove('show');
  });

  Live2DModel.onReady(() => {
    // 查看模型行为信息
    const info = Live2DModel.getModelInfo();
    console.log('Motion 组:', info.motionGroups);
    console.log('表情:', info.expressionNames);

    // 方法1：简单指定 motion 组
    // Live2DModel.setTalkMotionGroup('Talk');

    // 方法2：自定义行为
    // Live2DModel.setTalkAction((model, text, duration) => {
    //   model.startRandomMotion('Speak', 3);
    //   model.setRandomExpression();
    // });

    // 设置文本库并开启自动说话
    Live2DModel.setTalkTexts([
      '你好呀！', '今天天气真好~', '有什么想聊的吗？'
    ]);
    Live2DModel.startAutoTalk(5000, 12000);
  });
</script>

</body>
</html>
```

---

## 四、文件结构

```
dist/
├── Core/
│   └── live2dcubismcore.js        # 核心库（必须第一个引入）
├── Framework/
│   └── Shaders/WebGL/             # 着色器 (.vert / .frag)
├── Resources/
│   ├── Haru/                      # 模型资源
│   │   ├── Haru.model3.json       # 模型定义
│   │   ├── Haru.moc3              # 模型数据
│   │   ├── motions/               # 动作
│   │   ├── expressions/           # 表情
│   │   └── Haru.2048/             # 贴图
│   ├── Mao/
│   └── ...
├── assets/
│   └── index-xxx.js               # 应用主模块（含 Live2DModel API）
├── index.html                     # 默认页面
└── local_test.html                # 功能演示页面
```

---

## 五、注意事项

1. **引入顺序**：`live2dcubismcore.js` 必须在 `index-xxx.js` 之前引入
2. **WAV 格式**：对口型仅支持线性 PCM（8/16/24 bit），不支持 MP3
3. **跨域**：CDN 部署需 `Access-Control-Allow-Origin: *`
4. **WebGL**：需要 WebGL 支持（主流浏览器均支持）
5. **自定义模型**：不同模型的 motion 组名、表情名可能不同，用 `getModelInfo()` 查看后用 `setTalkAction()` 或 `setTalkMotionGroup()` 适配
6. **构建产物**：修改源码后需运行 `npm run build` 重新打包，生成新的 `index-{hash}.js`
7. **快速体验**：可直接引用线上测试地址快速开始`index-D_XhA1Zb.js`
