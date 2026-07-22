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

### 2.2 生命周期钩子

#### `Live2DModel.onReady(callback)`
模型完成加载（纹理、着色器、动作全部就绪）时触发。

```js
Live2DModel.onReady(() => {
  console.log('模型已就绪，可以开始交互');
});
```

---

### 2.3 对口型 & 说话

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

### 2.4 自动说话

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

### 2.5 说话行为自定义（适配不同模型）

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

### 2.6 模型行为信息

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

### 2.7 气泡钩子

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
