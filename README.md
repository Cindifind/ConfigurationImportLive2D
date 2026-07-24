# Live2D Cubism SDK Plugin — API 文档

基于 Live2D Cubism SDK for Web 5-r.5 (TypeScript) + Vite 构建，打包产物为固定文件名 `live2dplugin.js`。

---

## 快速开始

```html
<!-- 1. 引入 Core（必须在 plugin 之前） -->
<script src="./Core/live2dcubismcore.js"></script>

<!-- 2. 引入 plugin -->
<script type="module" crossorigin src="./live2dplugin.js"></script>

<!-- 3. 配置元素 -->
<div id="live2d-wrapper" class="live2d-wrapper">
  <div class="live2d-config"
       data-cubism-model="Elysia"
       data-model-path="./Elysia"
       data-show-background="false"
       data-shader-path="https://your-cdn.com/Framework/Shaders/WebGL/"
       data-container="#live2d-wrapper">
  </div>
</div>

<!-- 4. 使用 API -->
<script>
  Live2DModel.onReady(() => {
    console.log('模型就绪');
  });
</script>
```

> **注意**：`live2dplugin.js` 是 ES module，内联 `<script>` 在它之前执行。需要轮询等待 `window.Live2DModel` 可用后再调用。

```js
(function waitForSDK() {
  if (window.Live2DModel) {
    Live2DModel.onReady(() => { /* ... */ });
  } else {
    setTimeout(waitForSDK, 100);
  }
})();
```

---

## 一、HTML 属性配置

在 `data-cubism-model` 同级元素上设置：

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `data-cubism-model` | `string` | `"Haru"` | 模型名称（与文件夹名一致） |
| `data-model-path` | `string` | `./Resources/` | 模型根目录（支持跨域 URL） |
| `data-show-background` | `"true"` / `"false"` | `"true"` | 是否显示背景图 |
| `data-background-image` | `string` | 空 | 自定义背景图 URL |
| `data-shader-path` | `string` | 空 | 自定义着色器路径（跨域 CDN 用） |
| `data-container` | `string` | 空 | canvas 挂载目标容器 CSS 选择器 |

---

## 二、全局 API — `window.Live2DModel`

所有突变类 API 在模型就绪前静默无操作；钩子注册类 API 始终可调用。

### 2.1 生命周期

#### `Live2DModel.onReady(callback)`

模型就绪时触发。已就绪则立即执行。

```js
Live2DModel.onReady(() => { /* 模型已加载完成 */ });
```

#### `Live2DModel.whenReady()`

返回 Promise，模型就绪时 resolve。

```js
await Live2DModel.whenReady();
```

---

### 2.2 模型控制

#### `Live2DModel.changeModel(name)`

运行时切换模型（无需刷新页面）。

```js
Live2DModel.changeModel('Mao');
```

#### `Live2DModel.showBackground(show)`

运行时开关背景图。

```js
Live2DModel.showBackground(false);
```

#### `Live2DModel.setConfig(key, value)`

修改配置项。

```js
Live2DModel.setConfig('shaderPath', 'https://cdn.example.com/Shaders/WebGL/');
```

#### `Live2DModel.refresh()`

刷新页面，应用所有配置变更。

---

### 2.3 容器控制

#### `Live2DModel.getContainer()`

获取 canvas 所在的父容器元素。

```js
const el = Live2DModel.getContainer(); // → HTMLElement
```

#### `Live2DModel.setContainer(el | selector)`

程序化设置 canvas 容器，需 `refresh()` 生效。

```js
Live2DModel.setContainer('#my-wrapper');
Live2DModel.refresh();
```

---

### 2.4 缩放控制

等比例缩放，范围 30% ~ 100%，模型始终居中。

| 方法 | 说明 |
|---|---|
| `setScale(scale)` | 设置缩放值（0.3 ~ 1.0） |
| `getScale()` | 获取当前缩放值 |
| `zoomByWheel(delta)` | 滚轮缩放（传入 `wheel` 事件的 `deltaY`） |

```js
Live2DModel.setScale(0.6);

// 绑定滚轮缩放
wrapper.addEventListener('wheel', (e) => {
  e.preventDefault();
  Live2DModel.zoomByWheel(e.deltaY);
}, { passive: false });
```

---

### 2.5 说话 / 对口型

解析 WAV PCM 数据，提取 RMS 驱动口型参数。

#### `Live2DModel.startTalk(audioUrl, text?)`

```js
Live2DModel.startTalk('./sounds/hello.wav', '你好！');
Live2DModel.startTalk('', '嗯...'); // 无音频，用行为模拟
```

#### `Live2DModel.stopTalk()`

立即停止当前说话。

#### `Live2DModel.startAutoTalk(minMs?, maxMs?)`

随机间隔自动说话。默认 8~20 秒。

```js
Live2DModel.startAutoTalk(5000, 12000);
```

#### `Live2DModel.stopAutoTalk()`

停止自动说话。

#### `Live2DModel.setTalkTexts(texts)`

设置自动说话的文本库。

```js
Live2DModel.setTalkTexts(['你好！', '今天天气真好~', '有什么想聊的？']);
```

---

### 2.6 说话行为自定义

#### `Live2DModel.getModelInfo()`

获取模型支持的 motion 组、表情名、是否支持口型。

```js
const info = Live2DModel.getModelInfo();
// { motionGroups: ['Idle', 'Talk'], expressionNames: ['F01', 'F02'], hasLipSync: true }
```

#### `Live2DModel.setTalkMotionGroup(groupName)`

指定说话时播放的 motion 组。

```js
Live2DModel.setTalkMotionGroup('Talk');
```

#### `Live2DModel.setTalkAction(callback | null)`

完全自定义说话行为。传 `null` 恢复自动检测。

```js
Live2DModel.setTalkAction((model, text, duration) => {
  model.setRandomExpression();
  model.startRandomMotion('Speak', 3);
});
```

**自动检测优先级**：表情 → motion 组（非 Idle） → 仅气泡。

---

### 2.7 气泡钩子

#### `Live2DModel.onTalkStart(callback)`

说话开始时触发。回调：`(text, durationSec)`。

```js
Live2DModel.onTalkStart((text, durationSec) => {
  bubble.textContent = text;
  bubble.style.display = 'block';
});
```

#### `Live2DModel.onTalkEnd(callback)`

说话结束时触发。

```js
Live2DModel.onTalkEnd(() => { bubble.style.display = 'none'; });
```

---

### 2.8 触控区域

#### `Live2DModel.onHitArea(areaName, callback)`

注册指定区域点击回调。回调：`(areaName, x, y)`。

```js
Live2DModel.onHitArea('Head', (name, x, y) => {
  Live2DModel.startTalk('', '别摸头！');
});
```

#### `Live2DModel.offHitArea(areaName, callback)`

移除指定区域回调。

#### `Live2DModel.onAnyTap(callback)`

注册任意点击回调。回调：`(x, y)`。

```js
Live2DModel.onAnyTap((x, y) => { console.log('点击了', x, y); });
```

---

### 2.9 Motion 播放

#### `Live2DModel.loadMotion(name, url)`

加载外部 `.motion3.json` 并注册。返回 Promise。

```js
await Live2DModel.loadMotion('lasi', './pinkcat/lasi.motion3.json');
```

#### `Live2DModel.playMotion(name, priority?)`

播放已注册的 motion。优先级默认 3（强制）。

```js
Live2DModel.playMotion('lasi');
```

#### `Live2DModel.stopAllMotions()`

停止所有 motion 播放并重置参数。

---

### 2.10 参数动画（关键帧）

不依赖 motion 文件，直接操作模型参数值实现自定义动画。参数 ID 来自模型 `.cdi3.json` 的 `Parameters` 段。

#### `Live2DModel.setAction(name, keyframes)`

注册一个关键帧动画。

```js
Live2DModel.setAction('脸红', [
  { paramId: 'shy', value: 0,   delay: 0    },  // 立即归零
  { paramId: 'shy', value: 1,   delay: 300  },  // 0.3秒后设为1
  { paramId: 'shy', value: 1,   delay: 1000 },  // 保持1秒
  { paramId: 'shy', value: 0,   delay: 300  },  // 0.3秒后归零
]);
```

**关键帧字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `paramId` | `string` | 模型参数 ID（如 `shy`, `Param91`） |
| `value` | `number` | 目标值（取决于参数范围，通常 0~1） |
| `delay` | `number` | 距上一帧的延迟（毫秒），默认 0 |

**工作原理**：在每帧 `update()` 的最后阶段（motion、物理、眨眼等所有系统更新完毕后）写入参数值，确保自定义动画不会被覆盖。

#### `Live2DModel.playAction(name)`

播放已注册的参数动画。

```js
Live2DModel.playAction('脸红');
```

#### `Live2DModel.removeAction(name)`

移除已注册的动画。

```js
Live2DModel.removeAction('脸红');
```

#### `Live2DModel.listAnimNames()`

返回所有已注册的动画名称数组。

```js
Live2DModel.listAnimNames(); // → ['脸红', '吐舌', '生气']
```

#### `Live2DModel.listAnimActions()`

列出所有动画的详细关键帧信息。返回数组并在 Console 打印表格。

```js
const anims = Live2DModel.listAnimActions();
// Console.table: action, step, paramId, value, delay
```

---

### 2.11 通用动作注册表

将任意行为注册为具名函数，与参数动画系统独立。

#### `Live2DModel.registerAction(name, fn)`

```js
Live2DModel.registerAction('greet', (text) => {
  Live2DModel.startTalk('', text);
});
```

#### `Live2DModel.triggerAction(name, ...args)`

```js
Live2DModel.triggerAction('greet', '你好！');
```

#### `Live2DModel.unregisterAction(name)`

移除动作。

#### `Live2DModel.listActions()`

返回已注册的动作名称数组。

```js
Live2DModel.listActions(); // → ['greet', 'switchModel']
```

---

### 2.12 参数查询

#### `Live2DModel.getParameter(paramId)`

获取单个参数的完整信息。

```js
Live2DModel.getParameter('shy');
// → { id: 'shy', index: 0, min: 0, max: 1, default: 0, current: 0.5 }
```

**返回字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 参数 ID |
| `index` | `number` | 参数索引 |
| `min` | `number` | 最小值 |
| `max` | `number` | 最大值 |
| `default` | `number` | 默认值 |
| `current` | `number` | 当前值 |

#### `Live2DModel.listParameters()`

列出模型所有参数的完整信息。返回数组并在 Console 打印表格。

```js
const params = Live2DModel.listParameters();
// Console.table: index, id, min, max, default, current
```

---

## 三、渲染管线

```
初始化流程:
  live2dcubismcore.js 加载
  → live2dplugin.js (ES module) 加载
  → initApp() 读取 HTML data-* 属性
  → LAppDelegate.initialize() 创建 WebGL + canvas
  → DynamicModelLoader 加载模型 (.model3.json)
  → waitForShadersThenRun() 轮询着色器状态
  → 着色器就绪 → 启动渲染循环 (run)

每帧 update():
  loadParameters()           ← 恢复上一帧保存的状态
  motionManager.update()     ← motion 驱动参数
  saveParameters()           ← 保存当前参数
  _updateScheduler           ← 物理、眨眼、呼吸、口型等效果
  _applyParamOverrides()     ← 参数动画覆盖（setAction/playAction）
  model.update()             ← 应用参数 → 渲染
```

---

## 四、文件结构

```
dist/
├── Core/
│   └── live2dcubismcore.js     # 核心库（必须第一个引入）
├── Framework/
│   └── Shaders/WebGL/          # 着色器文件
├── Elysia/                     # 模型资源
│   ├── Elysia.model3.json
│   ├── Elysia.moc3
│   └── ...
├── pinkcat/                    # 另一个模型
├── live2dplugin.js             # 应用主模块（固定文件名）
├── index.html                  # Vite 构建入口
├── test.html                   # Elysia 测试页
└── test-pinkcat.html           # PinkCat 测试页
```

---

## 五、构建

```bash
npm install
npm run build    # 输出到 dist/，产物为 live2dplugin.js
```

---

## 六、腾讯云边缘函数

`edge-functions/_middleware.ts`：处理跨域请求，添加 `Access-Control-Allow-Origin: *` 响应头。

```js
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});
```

---

## 七、常见问题

**Q: 模型加载但不渲染？**
A: 检查 Console 是否有 `[CSM][W]Shader program is not initialized`，确认 `data-shader-path` 配置正确。

**Q: 跨域纹理加载 SecurityError？**
A: 着色器和纹理服务器需设置 `Access-Control-Allow-Origin: *`，或使用边缘函数代理。

**Q: `Live2DModel.onReady` 不触发？**
A: 模型加载完成（`_state === CompleteSetup = 23`）时触发。确认 Console 有 `[Live2D] onReady checker: 模型就绪!` 日志。

**Q: 自定义动画参数被覆盖？**
A: `playAction` 使用 `_paramOverrides` 机制在每帧最后阶段写入。确认 `setAction` 的 `paramId` 与模型参数一致（用 `listParameters()` 查询）。

**Q: `stopAllMotions` 后 motion 仍在播放？**
A: `stopAllMotions` 会替换 `_motionManager` 实例 + 重置参数 + 跳过 `loadParameters`。确认 Console 有完成日志。
