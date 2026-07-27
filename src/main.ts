/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from './lappdelegate';
import * as LAppDefine from './lappdefine';
import { DynamicModelLoader } from './dynamic_model_loader';
import { Live2DModelAPI, setReady } from './api/live2dmodel-api';

// 声明全局配置接口
interface Window {
  Live2DConfig?: {
    modelPath?: string;
    modelName?: string;
    showBackground?: boolean;
    backgroundImage?: string;
    shaderPath?: string;
  };
}

/**
 * アプリケーションの初期化処理
 * 页面加载完成 或 动态import后 都会调用
 */
async function initApp(): Promise<void> {
  console.log('[Live2D] initApp() 开始初始化...');
  
  // 从HTML元素获取配置
  const configElement = document.getElementById('live2d-container') || document.querySelector('[data-cubism-model]');
  
  // 默认使用 lappdefine 中的 ResourcesPath（支持跨域CDN配置）
  let modelPath = LAppDefine.ResourcesPath;
  let modelName = 'Haru';
  
  // 优先级：HTML data属性 > URL参数 > 默认值
  let showBackground = true; // 默认显示背景图
  let backgroundImage = '';  // 自定义背景图路径（空字符串 = 使用默认）
  let shaderPath = '';       // 自定义着色器路径（空字符串 = 使用默认）
  let targetContainer: HTMLElement | undefined = undefined;

  if (configElement) {
    const htmlModelPath = configElement.getAttribute('data-model-path');
    const htmlModelName = configElement.getAttribute('data-cubism-model');
    const htmlShowBg = configElement.getAttribute('data-show-background');
    const htmlBgImage = configElement.getAttribute('data-background-image');
    const htmlShaderPath = configElement.getAttribute('data-shader-path');
    const htmlContainer = configElement.getAttribute('data-container');

    if (htmlModelPath) modelPath = htmlModelPath;
    if (htmlModelName) modelName = htmlModelName;
    if (htmlShowBg !== null) showBackground = htmlShowBg === 'true';
    if (htmlBgImage !== null) backgroundImage = htmlBgImage;
    if (htmlShaderPath !== null) shaderPath = htmlShaderPath;

    // 容器：data-container 可以是 CSS 选择器，未指定则使用配置元素自身
    if (htmlContainer) {
      targetContainer = document.querySelector(htmlContainer) as HTMLElement || undefined;
      if (!targetContainer) {
        console.warn(`[Live2D] data-container 选择器 "${htmlContainer}" 未匹配到任何元素，回退到配置元素自身`);
      }
    }
    if (!targetContainer) {
      targetContainer = configElement as HTMLElement;
    }

    // 检查通过 API 设置的容器覆盖
    if ((window as any)._live2dContainer) {
      targetContainer = (window as any)._live2dContainer;
    }

    console.log(`[Live2D] HTML配置: modelPath=${modelPath}, modelName=${modelName}, showBackground=${showBackground}, bgImage=${backgroundImage || '默认'}, shaderPath=${shaderPath || '默认'}, container=${htmlContainer || '(自身)'}`);
  } else {
    console.log('[Live2D] 未检测到 HTML 容器属性');
    const urlParams = new URLSearchParams(window.location.search);
    const urlModelPath = urlParams.get('modelPath');
    const urlModelName = urlParams.get('modelName');
    const urlShowBg = urlParams.get('showBackground');
    const urlBgImage = urlParams.get('backgroundImage');
    const urlShaderPath = urlParams.get('shaderPath');
    
    if (urlModelPath) modelPath = urlModelPath;
    if (urlModelName) modelName = urlModelName;
    if (urlShowBg !== null) showBackground = urlShowBg === 'true';
    if (urlBgImage !== null) backgroundImage = urlBgImage;
    if (urlShaderPath !== null) shaderPath = urlShaderPath;
  }
  
  // 保存配置到全局变量
  (window as any).Live2DConfig = {
    modelPath: modelPath,
    modelName: modelName,
    showBackground: showBackground,
    backgroundImage: backgroundImage,
    shaderPath: shaderPath
  };
  
  console.log(`[Live2D] 开始初始化 WebGL 和应用程序...`);

  // Initialize WebGL and create the application instance
  if (!LAppDelegate.getInstance().initialize(targetContainer)) {
    console.error('[Live2D] LAppDelegate.initialize() 失败!');
    return;
  }
  console.log('[Live2D] LAppDelegate.initialize() 完成');

  // 串行等待：模型加载 → 着色器加载 → 设置 ready → 启动渲染
  try {
    console.log('[Live2D] 等待模型加载...');
    const model = await DynamicModelLoader.loadModelFromHtmlConfig();

    if (model) {
      console.log('[Live2D] 模型就绪，等待着色器...');
      await model.whenShadersReady();
      console.log('[Live2D] 着色器就绪');
    }

    // 设置 ready 并触发所有排队的 onReady 回调
    setReady();

    // 启动渲染循环
    LAppDelegate.getInstance().run();
  } catch (e) {
    console.error('[Live2D] 初始化失败:', e);
    // 降级：强制启动渲染循环
    LAppDelegate.getInstance().run();
  }
}

/**
 * ブラウザロード後の処理
 */
if (document.readyState === 'complete') {
  initApp();
} else {
  window.addEventListener('load', () => { initApp(); }, { passive: true });
}

/**
 * 終了時の処理
 */
window.addEventListener(
  'beforeunload',
  (): void => LAppDelegate.releaseInstance(),
  { passive: true }
);

// ===== 挂载 API 到全局 =====
(window as any).Live2DModel = Live2DModelAPI;
