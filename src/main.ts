/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from './lappdelegate';
import { DynamicModelLoader } from './dynamic_model_loader';
import { Live2DModelAPI, setReady } from './api/live2dmodel-api';

// 声明全局配置接口
interface Window {
  Live2DConfig?: {
    modelName?: string;
    texturePath?: string;
    showBackground?: boolean;
    backgroundImage?: string;
    shaderPath?: string;
  };
}

/**
 * アプリケーションの初期化処理
 */
async function initApp(): Promise<void> {
  console.log('[Live2D] initApp() 开始初始化...');

  const configElement = document.getElementById('live2d-container') || document.querySelector('[data-cubism-model]');

  let modelName = 'Haru';
  let texturePath: string | undefined;
  let showBackground = true;
  let backgroundImage = '';
  let shaderPath = '';
  let targetContainer: HTMLElement | undefined = undefined;

  if (configElement) {
    const htmlModelName = configElement.getAttribute('data-cubism-model');
    const htmlTexturePath = configElement.getAttribute('data-model-path');
    const htmlShowBg = configElement.getAttribute('data-show-background');
    const htmlBgImage = configElement.getAttribute('data-background-image');
    const htmlShaderPath = configElement.getAttribute('data-shader-path');
    const htmlContainer = configElement.getAttribute('data-container');

    if (htmlModelName) modelName = htmlModelName;
    if (htmlTexturePath) texturePath = htmlTexturePath;
    if (htmlShowBg !== null) showBackground = htmlShowBg === 'true';
    if (htmlBgImage !== null) backgroundImage = htmlBgImage;
    if (htmlShaderPath !== null) shaderPath = htmlShaderPath;

    if (htmlContainer) {
      targetContainer = document.querySelector(htmlContainer) as HTMLElement || undefined;
      if (!targetContainer) {
        console.warn(`[Live2D] data-container "${htmlContainer}" 未匹配到任何元素`);
      }
    }
    if (!targetContainer) targetContainer = configElement as HTMLElement;
    if ((window as any)._live2dContainer) targetContainer = (window as any)._live2dContainer;

    console.log(`[Live2D] 配置: model=${modelName}, texture=${texturePath || '(模型目录)'}, bg=${showBackground}, shader=${shaderPath || '默认'}`);
  } else {
    console.log('[Live2D] 未检测到 HTML 容器属性');
    const urlParams = new URLSearchParams(window.location.search);
    const urlModelName = urlParams.get('modelName');
    const urlTexturePath = urlParams.get('texturePath');
    const urlShowBg = urlParams.get('showBackground');
    const urlBgImage = urlParams.get('backgroundImage');
    const urlShaderPath = urlParams.get('shaderPath');

    if (urlModelName) modelName = urlModelName;
    if (urlTexturePath) texturePath = urlTexturePath;
    if (urlShowBg !== null) showBackground = urlShowBg === 'true';
    if (urlBgImage !== null) backgroundImage = urlBgImage;
    if (urlShaderPath !== null) shaderPath = urlShaderPath;
  }

  (window as any).Live2DConfig = {
    modelName,
    texturePath,
    showBackground,
    backgroundImage,
    shaderPath
  };

  console.log('[Live2D] 开始初始化 WebGL...');

  if (!LAppDelegate.getInstance().initialize(targetContainer)) {
    console.error('[Live2D] LAppDelegate.initialize() 失败!');
    return;
  }

  try {
    console.log('[Live2D] 等待模型加载...');
    const model = await DynamicModelLoader.loadModelFromHtmlConfig();

    if (model) {
      console.log('[Live2D] 模型就绪，等待着色器...');
      await model.whenShadersReady();
    }

    setReady();
    LAppDelegate.getInstance().run();
  } catch (e) {
    console.error('[Live2D] 初始化失败:', e);
    LAppDelegate.getInstance().run();
  }
}

if (document.readyState === 'complete') {
  initApp();
} else {
  window.addEventListener('load', () => { initApp(); }, { passive: true });
}

window.addEventListener(
  'beforeunload',
  (): void => LAppDelegate.releaseInstance(),
  { passive: true }
);

(window as any).Live2DModel = Live2DModelAPI;
