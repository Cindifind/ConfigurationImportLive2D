# Live2D Cubism Web SDK 静态部署解决方案

## 项目概述

本项目提供了一套完整的Live2D Cubism Web SDK静态部署解决方案，支持：

- 通过HTML标签引入编译后的JavaScript文件
- 从本地或远程服务器加载模型资源
- 通过URL参数配置模型路径和资源位置
- 动态模型切换功能

## 构建与部署

### 构建项目

1. 确保已安装Node.js环境
2. 运行构建命令：
```bash
npm run build:prod
```

构建完成后，`dist/`目录将包含所有必要的文件。

### 部署到服务器

将整个`dist/`目录上传到您的Web服务器，确保目录结构保持不变。

## 静态查看器

项目提供两个静态查看器：

### 1. 基础静态查看器
- 文件：`static_viewer.html`
- 功能：基本模型选择和显示
- 适用：简单查看需求

### 2. 增强静态查看器
- 文件：`advanced_static_viewer.html`
- 功能：高级配置选项、调试信息
- 适用：需要更多控制的场景

## 使用方法

### 本地运行

使用Python启动本地服务器：
```bash
python -m http.server 8000
```

或使用Node.js：
```bash
npx http-server
```

### URL参数配置

支持以下URL参数来自定义模型加载：

- `?modelPath=` - 指定模型资源的基础路径
- `?modelName=` - 指定要加载的模型名称
- `?jsonName=` - 指定模型JSON文件名

示例：
```
http://localhost:8000/static_viewer.html?modelPath=./Resources/&modelName=Haru
```

## 目录结构

```
dist/                           # 构建输出目录
├── assets/                     # 编译后的JS文件
│   └── index-[hash].js         # 主应用代码
├── Core/                       # Live2D Core库
│   └── live2dcubismcore.js     # 核心库文件
├── Framework/                  # 框架文件
│   └── Shaders/                # WebGL着色器
├── Resources/                  # 模型资源
│   ├── Haru/                   # Haru模型
│   ├── Hiyori/                 # Hiyori模型
│   └── ...                     # 其他模型
└── index.html                  # 默认入口页面

static_viewer.html             # 基础静态查看器
advanced_static_viewer.html    # 增强静态查看器
start_server.bat               # Windows启动脚本
start_server.js                # Node.js服务器脚本
```

## 自定义模型

要在静态查看器中加载自定义模型：

1. 将模型文件放入`Resources/`目录下对应子目录
2. 确保模型文件夹包含`.model3.json`文件
3. 在查看器中选择或输入模型名称

## 技术说明

### 构建流程
1. `copy_resources.js` 复制必要的资源文件到public目录
2. Vite使用`@framework`别名引用框架源代码
3. 构建过程将TypeScript编译为浏览器兼容的JavaScript
4. 所有资源被打包到dist目录

### 静态部署要点
- 编译后的代码不再依赖源代码目录
- 所有路径配置支持相对路径
- 支持CORS友好的资源加载

## 故障排除

### 常见问题
- 模型无法加载：检查资源路径是否正确
- JavaScript错误：确保所有依赖文件都已加载
- Canvas空白：检查浏览器是否支持WebGL

### 调试技巧
- 使用增强查看器中的调试信息功能
- 检查浏览器控制台错误信息
- 确认服务器MIME类型设置正确

## 许可证

本项目基于Live2D Open Software License协议。

更多详情请参阅官方文档和LICENSE文件。