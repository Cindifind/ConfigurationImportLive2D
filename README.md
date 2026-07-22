# Live2D Cubism SDK for Web — 使用文档

基于 Live2D Cubism SDK for Web 5-r.5 (TypeScript)，支持 `<script>` 标签引入、HTML 属性配置、全局 API 控制。

---

## 快速开始

```html
<!-- 1. 容器元素 + 配置属性 -->
<div id="live2d-container"
     data-model-path="./Resources/"
     data-cubism-model="Haru"
     data-show-background="true">
</div>

<!-- 2. 引入两个脚本 -->
<script src="dist/Core/live2dcubismcore.js"></script>
<script type="module" src="./assets/index-xxx.js"></script>

<!-- 3. 通过 Live2DModel API 交互 -->
<script>
    Live2DModel.onReady(() => {
        console.log('模型就绪');
    });
</script>
```

---

## 一、HTML 属性配置

在 `#live2d-container` 元素上设置 `data-*` 属性：

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `data-cubism-model` | `string` | `"Haru"` | 模型名称（需与模型文件夹名一致） |
| `data-model-path` | `string` | `./Resources/` | 模型资源根目录（支持跨域 URL） |
| `data-show-background` | `"true"` / `"false"` | `"true"` | 是否显示背景图片 |
| `data-background-image` | `string` | 空（使用默认） | 自定义背景图地址（支持 http/https 或相对路径） |
| `data-shader-path` | `string` | 空（使用默认） | 自定义着色器路径（跨域 CDN 部署时使用） |

### 跨域 CDN 部署

```html
<div id="live2d-container"
     data-model-path="https://cdn.example.com/live2d/Resources/"
     data-cubism-model="Haru"
     data-shader-path="https://cdn.example.com/live2d/Framework/Shaders/WebGL/"
     data-background-image="https://cdn.example.com/live2d/Resources/bg.png"
     data-show-background="true">
</div>
```

也可通过全局变量配置基础 URL，无需每个属性重复写域名：

```html
<script>
  window.LIVE2D_BASE_URL = 'https://cdn.example.com/live2d/';
</script>
<script type="module" src="https://cdn.example.com/live2d/assets/index-xxx.js"></script>
```

---

## 二、全局 API — `window.Live2DModel`

### 2.1 模型控制

#### `Live2DModel.changeModel(name)`
运行时切换模型，无需刷新页面。

```js
Live2DModel.changeModel('Mao');
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | `string` | 模型名称，如 `'Haru'`、`'Mao'` |

---

#### `Live2DModel.showBackground(show)`
运行时切换背景图显示/隐藏，无需刷新页面。

```js
Live2DModel.showBackground(false); // 隐藏背景
Live2DModel.showBackground(true);  // 显示背景
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `show` | `boolean` | `true` = 显示，`false` = 隐藏 |

---

### 2.2 配置管理（需刷新）

#### `Live2DModel.setConfig(key, value)`
修改配置项，修改后需调用 `refresh()` 刷新页面生效。

```js
Live2DModel.setConfig('modelPath', 'https://cdn.example.com/live2d/Resources/');
Live2DModel.setConfig('modelName', 'Mao');
Live2DModel.setConfig('backgroundImage', './custom_bg.png');
Live2DModel.setConfig('shaderPath', './shaders/');
Live2DModel.refresh(); // 刷新应用配置
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | 配置键：`'modelPath'` / `'modelName'` / `'showBackground'` / `'backgroundImage'` / `'shaderPath'` |
| `value` | `string \| boolean` | 配置值 |

#### `Live2DModel.refresh()`
刷新页面，应用 `setConfig` 的更改。

---

### 2.3 说话 & 对口型

Live2D SDK 通过解析 WAV 文件的 PCM 数据提取 RMS（音量包络），驱动模型口型参数，无需真实播放音频。

#### `Live2DModel.startTalk(audioUrl, text?)`
播放 WAV 音频并对口型，同时触发气泡钩子。

```js
// 传入音频文件路径
Live2DModel.startTalk('./sounds/hello.wav', '你好！我是 Live2D~');

// 不传音频：仅显示气泡（无口型动画）
Live2DModel.startTalk('', '嗯…今天天气不错~');
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `audioUrl` | `string` | 是 | WAV 音频文件 URL（传空字符串表示无音频） |
| `text` | `string` | 否 | 气泡中显示的文本 |

#### `Live2DModel.stopTalk()`
立即停止当前说话，触发 `onTalkEnd` 回调。

---

#### `Live2DModel.startAutoTalk(minIntervalMs?, maxIntervalMs?)`
开启自动说话，随机间隔触发。

```js
// 默认间隔 8~20 秒
Live2DModel.startAutoTalk();

// 自定义间隔 5~12 秒
Live2DModel.startAutoTalk(5000, 12000);
```

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `minIntervalMs` | `number` | `8000` | 最小间隔（毫秒） |
| `maxIntervalMs` | `number` | `20000` | 最大间隔（毫秒） |

#### `Live2DModel.stopAutoTalk()`
停止自动说话。

#### `Live2DModel.setTalkTexts(texts)`
设置自动说话时随机选取的文本库。

```js
Live2DModel.setTalkTexts([
  '你好呀！',
  '今天天气真好~',
  '有什么想聊的吗？',
  '哈哈，有意思！'
]);
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `texts` | `string[]` | 文本数组 |

---

### 2.4 钩子函数（Hooks）

#### `Live2DModel.onReady(callback)`
模型加载完成回调。

```js
Live2DModel.onReady(() => {
  console.log('模型已就绪，可以开始交互');
  Live2DModel.startAutoTalk();
});
```

---

#### `Live2DModel.onTalkStart(callback)`
说话开始回调，用于显示自定义气泡 UI。

```js
Live2DModel.onTalkStart((text, durationSec) => {
  // text:       说话文本
  // durationSec: 预计持续时长（秒）
  document.getElementById('my-bubble').textContent = text;
  document.getElementById('my-bubble').style.display = 'block';
});
```

| 回调参数 | 类型 | 说明 |
|---|---|---|
| `text` | `string` | 说话文本内容 |
| `durationSec` | `number` | 预计持续时长（秒），可用于气泡淡出动画 |

---

#### `Live2DModel.onTalkEnd(callback)`
说话结束回调，用于隐藏气泡 UI。

```js
Live2DModel.onTalkEnd(() => {
  document.getElementById('my-bubble').style.display = 'none';
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

    /* 自定义气泡样式 */
    #my-bubble {
      position: absolute; top: 15%; left: 55%;
      max-width: 260px; padding: 10px 16px;
      border-radius: 14px;
      background: rgba(255,255,255,0.9); color: #1e293b;
      font-size: 14px;
      opacity: 0; transition: opacity 0.3s;
      pointer-events: none; z-index: 20;
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

  // 气泡钩子
  Live2DModel.onTalkStart((text) => {
    bubble.textContent = text;
    bubble.classList.add('show');
  });
  Live2DModel.onTalkEnd(() => {
    bubble.classList.remove('show');
  });

  // 模型就绪后开始自动说话
  Live2DModel.onReady(() => {
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
│   └── live2dcubismcore.js     # Live2D 核心库（必须第一个引入）
├── Framework/
│   └── Shaders/WebGL/          # 着色器文件 (.vert / .frag)
├── Resources/
│   ├── Haru/                   # 模型资源（.moc3 / .model3.json / 贴图 / 动作 / 表情）
│   ├── Mao/
│   └── ...
├── assets/
│   └── index-xxx.js            # 应用主模块（包含 Live2DModel API）
├── index.html                  # Vite 构建的默认页面
└── local_test.html             # 功能演示页面
```

---

## 五、注意事项

1. **引入顺序**：`live2dcubismcore.js` 必须在 `index-xxx.js` 之前引入。
2. **WAV 格式**：对口型仅支持线性 PCM 编码的 WAV 文件（8/16/24 bit），不支持 MP3。
3. **跨域资源**：CDN 部署所有资源（模型/着色器/背景图）需配置 CORS 头 `Access-Control-Allow-Origin: *`。
4. **浏览器兼容**：需要 WebGL 支持（Chrome/Firefox/Edge/Safari 均支持）。
5. **模型目录规范**：模型文件夹名需与 `data-cubism-model` 值一致，且内含 `xxx.model3.json`。
6. **配置主要js**：需要自主打包后生成的 `index-hash.js`文件。
7. **测试js**：直接引入 `https://muqingxi.com/live2d/assets/index-BtpXaDW6.js` 文件快速开始。
