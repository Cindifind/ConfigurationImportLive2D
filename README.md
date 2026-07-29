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
<div id="live2d-wrapper">
  <div class="live2d-config"
       data-cubism-model="Elysia"
       data-model-path="./Elysia"
       data-show-background="false"
       data-shader-path="https://cdn.example.com/Framework/Shaders/WebGL/"
       data-container="#live2d-wrapper">
  </div>
</div>

<!-- 4. 使用 API -->
<script>
  (function waitForSDK() {
    if (window.Live2DModel) {
      Live2DModel.onReady(() => console.log('模型就绪'));
    } else {
      setTimeout(waitForSDK, 100);
    }
  })();
</script>
```

---

## 一、HTML 属性配置

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `data-cubism-model` | `string` | `"Haru"` | 模型路径，直接作为 moc3 / model3.json 目录 |
| `data-model-path` | `string` | 空（使用模型目录） | 贴图目录（与模型目录分开时可单独指定） |
| `data-show-background` | `"true"` / `"false"` | `"true"` | 是否显示背景图 |
| `data-background-image` | `string` | 空 | 自定义背景图 URL |
| `data-shader-path` | `string` | 空 | 自定义着色器路径（跨域 CDN 用） |
| `data-container` | `string` | 空 | canvas 挂载目标容器 CSS 选择器 |

### `data-cubism-model` 路径解析

直接作为模型目录，提取最后一段为模型名称。无拼接逻辑。

```
"./Elysia"                          → dir: "Elysia/",          name: "Elysia"
"./Elysia/Elysia"                   → dir: "Elysia/Elysia/",   name: "Elysia"
"Elysia"                            → dir: "Elysia/",          name: "Elysia"
"https://cdn.com/Resources/Elysia"  → dir: "https://cdn.com/Resources/Elysia/", name: "Elysia"
```

### 模型目录 vs 贴图目录

```
data-cubism-model  → moc3 / model3.json / motions / expressions
data-model-path    → 贴图图片（不设置则跟随模型目录）
```

```html
<!-- 模型和贴图分离 -->
<div class="live2d-config"
     data-cubism-model="Elysia"
     data-model-path="https://img.cdn.com/">
</div>
<!-- moc3: Elysia/Elysia.model3.json -->
<!-- 贴图: https://img.cdn.com/5493134230020097 -->
```

---

## 二、全局 API — `window.Live2DModel`

| 分类 | 方法 | 说明 |
|---|---|---|
| 生命周期 | `onReady(cb)` | 模型就绪回调 |
| | `whenReady()` | 返回 Promise |
| 模型控制 | `changeModel(name)` | 运行时切换模型 |
| | `showBackground(show)` | 开关背景图 |
| | `setConfig(key, value)` | 修改配置项 |
| | `refresh()` | 刷新页面 |
| 容器 | `getContainer()` | 获取容器元素 |
| | `setContainer(el)` | 设置容器（需 refresh） |
| 缩放 | `setScale(s)` / `getScale()` | 缩放控制（0.3~1.0） |
| | `zoomByWheel(delta)` | 滚轮缩放 |
| 说话 | `startTalk(url, text?)` | URL 播放 WAV 对口型 |
| | `startTalkFromBytes(buf, text?)` | ArrayBuffer 播放 WAV 对口型 |
| | `stopTalk()` | 停止说话 |
| | `startAutoTalk(min?, max?)` | 自动说话 |
| | `stopAutoTalk()` | 停止自动说话 |
| | `setTalkTexts(texts)` | 设置说话文本库 |
| 说话行为 | `getModelInfo()` | 获取模型 motion/表情信息 |
| | `setTalkMotionGroup(name)` | 指定说话 motion 组 |
| | `setTalkAction(fn\|null)` | 自定义说话行为 |
| 气泡钩子 | `onTalkStart(cb)` | 说话开始 |
| | `onTalkEnd(cb)` | 说话结束 |
| 触控 | `onHitArea(name, cb)` | 区域点击回调 |
| | `offHitArea(name, cb)` | 移除区域回调 |
| | `onAnyTap(cb)` | 任意点击回调 |
| Motion | `loadMotion(name, url)` | 加载外部 motion |
| | `playMotion(name, pri?)` | 播放注册的 motion |
| | `stopAllMotions()` | 停止所有 motion |
| 参数动画 | `setAction(name, kfs)` | 注册关键帧动画 |
| | `playAction(name)` | 播放参数动画 |
| | `removeAction(name)` | 移除动画 |
| | `listAnimNames()` | 列出动画名 |
| | `listAnimActions()` | 列出动画详情 |
| 通用动作 | `registerAction(name, fn)` | 注册命名动作 |
| | `triggerAction(name, ...args)` | 触发动作 |
| | `unregisterAction(name)` | 移除动作 |
| | `listActions()` | 列出动作名 |
| 参数查询 | `getParameter(id)` | 单参数详情 |
| | `listParameters()` | 全部参数列表 |
| 参数控制 | `setParameterValue(id, val, w?)` | 设置参数目标值（混合） |
| | `addParameterDelta(id, delta, w?)` | 叠加参数偏移（混合） |

---

### 2.1 生命周期

```js
// 回调方式
Live2DModel.onReady(() => { /* 模型就绪 */ });

// Promise 方式
await Live2DModel.whenReady();
```

### 2.2 模型控制

```js
// 切换模型（支持完整路径）
Live2DModel.changeModel('./pinkcat/pinkcat');
Live2DModel.changeModel('Mao');

// 背景
Live2DModel.showBackground(false);

// 运行时配置
Live2DModel.setConfig('shaderPath', 'https://cdn.example.com/Shaders/WebGL/');
```

### 2.3 容器控制

```js
Live2DModel.setContainer('#my-wrapper');
Live2DModel.refresh();

const el = Live2DModel.getContainer();
```

### 2.4 缩放控制

```js
Live2DModel.setScale(0.6);
Live2DModel.getScale(); // → 0.6

wrapper.addEventListener('wheel', (e) => {
  e.preventDefault();
  Live2DModel.zoomByWheel(e.deltaY);
}, { passive: false });
```

### 2.5 说话 / 对口型

解析 WAV PCM 数据，提取 RMS 驱动口型参数。仅支持 Linear PCM WAV（8/16/24-bit）。

```js
// URL 方式
Live2DModel.startTalk('./sounds/hello.wav', '你好！');

// ArrayBuffer 方式（WebSocket、用户上传等场景）
const res = await fetch('audio.wav');
const buf = await res.arrayBuffer();
Live2DModel.startTalkFromBytes(buf, '你好！');

// 无音频，用行为模拟
Live2DModel.startTalk('', '嗯...');

// 自动说话
Live2DModel.setTalkTexts(['你好！', '今天天气真好~']);
Live2DModel.startAutoTalk(5000, 12000);
Live2DModel.stopAutoTalk();
```

### 2.6 说话行为自定义

```js
const info = Live2DModel.getModelInfo();
// → { motionGroups: ['Idle', 'Talk'], expressionNames: ['F01'], hasLipSync: true }

// 指定 motion 组
Live2DModel.setTalkMotionGroup('Talk');

// 完全自定义
Live2DModel.setTalkAction((model, text, duration) => {
  model.setRandomExpression();
  model.startRandomMotion('Speak', 3);
});
// 恢复自动检测
Live2DModel.setTalkAction(null);
```

### 2.7 气泡钩子

```js
Live2DModel.onTalkStart((text, durationSec) => {
  bubble.textContent = text;
  bubble.style.display = 'block';
});
Live2DModel.onTalkEnd(() => { bubble.style.display = 'none'; });
```

### 2.8 触控区域

```js
Live2DModel.onHitArea('Head', (name, x, y) => {
  Live2DModel.startTalk('', '别摸头！');
});
Live2DModel.offHitArea('Head', callback);
Live2DModel.onAnyTap((x, y) => { console.log('点击了', x, y); });
```

### 2.9 Motion 播放

```js
await Live2DModel.loadMotion('lasi', './pinkcat/lasi.motion3.json');
Live2DModel.playMotion('lasi');
Live2DModel.stopAllMotions();
```

### 2.10 参数动画（关键帧）

```js
Live2DModel.setAction('脸红', [
  { paramId: 'shy', value: 1, delay: 300  },
  { paramId: 'shy', value: 0, delay: 1000 },
]);
Live2DModel.playAction('脸红');
Live2DModel.listAnimNames(); // → ['脸红']
```

### 2.11 通用动作注册表

```js
Live2DModel.registerAction('greet', (text) => {
  Live2DModel.startTalk('', text);
});
Live2DModel.triggerAction('greet', '你好！');
Live2DModel.listActions(); // → ['greet']
```

### 2.12 参数查询

```js
Live2DModel.getParameter('shy');
// → { id: 'shy', index: 0, min: 0, max: 1, default: 0, current: 0.5 }

Live2DModel.listParameters(); // Console.table 输出全部参数
```

### 2.13 参数控制（复用官方 SDK motion 混合公式）

两个参数控制方法均复用官方 SDK `CubismMotion.doUpdateParameters()` 的混合算法：

```
blended = sourceValue + (target - sourceValue) × weight
```

- `sourceValue`：当前帧系统值（loadParameters → motion → saveParameters → updaters 之后的干净值）
- `weight=0`：保持当前值不变；`weight=1`：立即到达目标值
- 写入时机在 `_applyParamOverrides()`（帧末最后一环），不被 `loadParameters()` 重置

**`setParameterValue(paramId, value, weight=1)`** — 绝对目标值混合

```js
// 立即设为目标值
Live2DModel.setParameterValue('ParamCheek', 0.8);

// 平滑过渡（适合鼠标跟踪、惯性效果）
Live2DModel.setParameterValue('ParamAngleX', lookX, 0.12);
// 每帧: blended = current + (lookX - current) * 0.12 → 渐进跟随
```

**`addParameterDelta(paramId, delta, weight=1)`** — 增量偏移混合

基线为参数默认值（`getParameterDefaultValue`），避免读到上帧 override 导致累积漂移。公式：`defaultValue + delta × weight`

```js
// 身体摆动（角度参数范围 [-30,30]，delta 需 1~3 才可见）
Live2DModel.addParameterDelta('ParamBodyAngleX', 2.0 * Math.sin(t));

// 平滑呼吸
Live2DModel.addParameterDelta('ParamBreath', 0.2 * Math.sin(t * 1.4), 0.5);

// 停止叠加（delta=0 即恢复默认值）
Live2DModel.addParameterDelta('ParamBodyAngleX', 0);
```

**与 SDK motion 的对应关系：**

| SDK motion 公式 | 对应 API |
|---|---|
| `source + (curveTarget - source) * fadeWeight` | `setParameterValue(id, val, weight)` |
| EyeBlink: `value *= eyeBlinkValue` | `setParameterValue` 手动乘 |
| LipSync: `value += lipSyncValue` | `addParameterDelta(id, delta, 1.0)` |
| 帧管线 | `paramOverride` 在 updaters 之后、model.update 之前 |

---

## 三、渲染管线

```
初始化流程（全 Promise 链，无轮询）:
  live2dcubismcore.js 加载
  → live2dplugin.js 加载
  → initApp() 读取 HTML data-* 属性
  → LAppDelegate.initialize() 创建 WebGL + canvas
  → DynamicModelLoader.loadModelFromHtmlConfig()
     → resolveModelPath()     解析模型路径
     → setTextureHomeDir()    设置贴图目录（在 loadAssets 之前）
     → loadAssets()           异步加载 .model3.json → moc3 → 贴图
     → whenSetupComplete()    等待所有资源加载完成
  → whenShadersReady()        等待着色器编译完成
  → setReady()                触发所有 onReady 回调
  → run()                     启动渲染循环

每帧 update():
  loadParameters()          ← 恢复上一帧保存的状态
  motionManager.update()    ← motion 驱动参数
  saveParameters()          ← 保存当前参数
  _updateScheduler          ← 物理、眨眼、呼吸、口型等
  _applyParamOverrides()    ← 参数动画覆盖（最后阶段）
  model.update()            ← 应用参数 → 渲染
```

---

## 四、文件结构

```
dist/
├── Core/live2dcubismcore.js     # 核心库（必须第一个引入）
├── Framework/Shaders/WebGL/     # 着色器文件
├── Elysia/                      # 模型资源（moc3 / 贴图）
├── pinkcat/                     # 模型资源
├── live2dplugin.js              # 应用主模块（固定文件名）
├── live2dplugin.js.map          # Source Map
├── index.html                   # Vite 构建入口
├── test.html                    # Elysia 测试页
├── test-pinkcat.html            # PinkCat 测试页
└── test-params.html             # 参数控制面板

src/
├── main.ts                      # 入口：配置解析 → 初始化
├── api/
│   └── live2dmodel-api.ts      # Live2DModel API 定义
├── dynamic_model_loader.ts      # 模型加载器（resolveModelPath）
├── lappmodel.ts                 # 模型类（加载 / 渲染 / 动画）
├── lappdelegate.ts              # 应用代理（WebGL 初始化 / 事件）
├── lappsubdelegate.ts           # Canvas 管理 / 鼠标跟随
├── lappview.ts                  # 渲染 / 缩放 / 背景
├── lapplive2dmanager.ts         # 模型管理器 / 触控
├── live2dtalkmanager.ts         # 说话管理器 / 对口型 / 气泡
├── lappwavfilehandler.ts        # WAV 解析（PCM → RMS → 口型）
├── lapptexturemanager.ts        # 纹理管理（跨域 / 错误处理）
├── touchmanager.ts              # 触摸管理器
├── lappdefine.ts                # 路径 / 常量定义
├── lappsprite.ts                # 精灵渲染
├── lappglmanager.ts             # WebGL 上下文管理
└── lapppal.ts                   # 平台抽象层
```

---

## 五、构建

```bash
npm install
npm run build    # 输出到 dist/，产物为 live2dplugin.js
npm run dev      # Vite 开发服务器（HMR）
```

---

## 六、常见问题

**Q: 贴图加载 404？**
A: 检查 `data-model-path` 配置。若不设置则使用模型目录，若设置则用于贴图。贴图路径 = `data-model-path` + `model3.json 中的纹理文件名`。

**Q: `data-cubism-model` 设置绝对 URL 后路径出错？**
A: 以 `http://` / `https://` / `//` 开头的会自动识别为绝对 URL，保持原样不拆分。

**Q: 跨域纹理加载 SecurityError？**
A: 贴图服务器需设置 `Access-Control-Allow-Origin: *`。代码已配置 `img.crossOrigin = 'anonymous'`。

**Q: `Live2DModel.onReady` 不触发？**
A: 确认 Console 有 `[Live2D] setReady: N 个回调已执行` 日志。

**Q: `stopAllMotions` 后参数未重置？**
A: 方法会替换 motionManager + 重置参数数组 + 跳过 2 帧 loadParameters 防止恢复旧值。

**Q: 页面跳转时报 `Cannot read properties of null (reading 'release')`？**
A: 所有 release 方法已添加 null 检查，`beforeunload` 时用 try/catch 包裹。
